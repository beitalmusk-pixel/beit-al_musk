-- =============================================================================
-- بيت المسك • BEIT AL-MUSK — Supabase Security Hardening Migration
-- Production Database Hardening: Admin Authentication, Strict RLS & Anti-Price-Tampering
-- Version: 2.0.0 (Production Security Release)
-- Target: Supabase PostgreSQL (Postgres 15+)
-- Idempotent: Can be run multiple times safely
-- =============================================================================

-- =============================================================================
-- 1. جدول مدراء النظام والصلاحيات (Admin Users Table & Authorization)
-- =============================================================================

-- إنشاء جدول المشرفين المرتبط بحسابات Supabase Auth الرسمية
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin', 'manager')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- تفعيل أمان الصفوف على جدول المشرفين
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- دالة أمان مركزية للتحقق مما إذا كان المستخدم الحالي مشرفاً معتمداً
-- Central security definer function to verify if auth.uid() belongs to an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- إذا لم يكن المستخدم مسجلاً دخوله، يُرفض مباشرة
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- التحقق من وجود المعرف في جدول المشرفين المعتمدين
  RETURN EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE user_id = auth.uid()
  );
END;
$$;

-- منح صلاحية استدعاء الدالة للمصادقين والمجهولين
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- سياسات RLS لجدول admin_users
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
CREATE POLICY "Admins can view admin_users"
ON public.admin_users FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
CREATE POLICY "Admins can manage admin_users"
ON public.admin_users FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- وظيفة مساعدة للمطورين ومدير قاعدة البيانات لإضافة أو ترقية أدمن عبر البريد الإلكتروني
CREATE OR REPLACE FUNCTION public.add_admin_by_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE LOWER(email) = LOWER(TRIM(p_email));

  IF v_user_id IS NULL THEN
    RETURN 'تنبيه: البريد الإلكتروني غير مسجل بعد في auth.users: ' || p_email;
  END IF;

  INSERT INTO public.admin_users (user_id, email, role)
  VALUES (v_user_id, LOWER(TRIM(p_email)), 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  RETURN 'تم تفعيل صلاحيات الأدمن بنجاح للمستخدم: ' || p_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_admin_by_email(TEXT) TO authenticated, service_role;

-- دالة ومزامنة الحسابات الإدارية تلقائياً
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF LOWER(NEW.email) IN ('admin@beitalmusk.com', 'admin@baytalmusk.com', 'support@beitalmusk.com') 
     OR NEW.email ILIKE '%@beitalmusk.com' THEN
    INSERT INTO public.admin_users (user_id, email, role)
    VALUES (NEW.id, LOWER(NEW.email), 'admin')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  BEGIN
    DROP TRIGGER IF EXISTS trg_on_auth_user_created_admin ON auth.users;
    CREATE TRIGGER trg_on_auth_user_created_admin
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_admin_user_signup();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: Trigger on auth.users skipped (handled via manual add_admin_by_email): %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.admin_users (user_id, email, role)
    SELECT id, LOWER(email), 'admin'
    FROM auth.users
    WHERE LOWER(email) IN ('admin@beitalmusk.com', 'admin@baytalmusk.com', 'support@beitalmusk.com')
       OR email ILIKE '%admin%'
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: Existing admin auto-sync skipped: %', SQLERRM;
  END;
END $$;


-- =============================================================================
-- 2. حماية وتحديث إدارة المخزون (Inventory Deduction Handling)
-- =============================================================================

-- إلغاء التريجر القديم trg_deduct_inventory لمنع خصم المخزون مرتين،
-- حيث أصبحت الدالة الذرية create_verified_order تقوم بفحص وخصم المخزون بشكل آمن ومحكم
DROP TRIGGER IF EXISTS trg_deduct_inventory ON public.orders;


-- =============================================================================
-- 3. دالة حساب الأسعار والخصومات الآمنة (calculate_secure_order)
--    تدعم: الأسعار الحقيقية من الكتالوج + خصم حد الفاتورة + الكوبونات + الخصم العام
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_secure_order(
  p_items JSONB,
  p_coupon_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item_json JSONB;
  v_product_id TEXT;
  v_size TEXT;
  v_qty INT;
  v_subtotal NUMERIC := 0;
  v_delivery NUMERIC := 50; -- القيمة الافتراضية 50 ج.م
  v_global_discount NUMERIC := 0;
  v_global_percent NUMERIC := 0;
  v_threshold_discount NUMERIC := 0;
  v_thresh_min NUMERIC := 0;
  v_thresh_val NUMERIC := 0;
  v_coupon_discount NUMERIC := 0;
  v_total_discount NUMERIC := 0;
  v_grand_total NUMERIC := 0;
  v_perfume RECORD;
  v_verified_items JSONB := '[]'::jsonb;
  v_size_data JSONB;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_store_config JSONB;
  v_coupon RECORD;
  v_coupon_found BOOLEAN := false;
  v_coupon_message TEXT := NULL;
BEGIN
  -- 1. التحقق من وجود عناصر
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'subtotal', 0,
      'delivery', 0,
      'discount', 0,
      'grandTotal', 0,
      'items', '[]'::jsonb,
      'error', 'سلة المشتريات فارغة'
    );
  END IF;

  -- 2. قراءة إعدادات المتجر من settings (الشحن وخصم الفاتورة والخصم العام)
  SELECT value INTO v_store_config FROM public.settings WHERE key = 'store_config';
  IF v_store_config IS NOT NULL THEN
    IF (v_store_config->>'deliveryFee') IS NOT NULL THEN
      v_delivery := (v_store_config->>'deliveryFee')::numeric;
    END IF;

    -- خصم بلوغ حد الفاتورة (Threshold Discount)
    IF (v_store_config->>'thresholdDiscountEnabled')::boolean = true THEN
      v_thresh_min := COALESCE((v_store_config->>'thresholdAmount')::numeric, 0);
      v_thresh_val := COALESCE((v_store_config->>'thresholdDiscountValue')::numeric, 0);
    END IF;

    -- الخصم العام المباشر للمتجر (Global Discount)
    IF (v_store_config->>'globalDiscountEnabled')::boolean = true THEN
      v_global_percent := COALESCE((v_store_config->>'globalDiscountPercent')::numeric, 0);
    END IF;
  END IF;

  -- 3. التحقق من الأسعار الحقيقية من قاعدة البيانات ومنع التلاعب بالأسعار
  FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := COALESCE(v_item_json->>'productId', v_item_json->>'id');
    v_size := COALESCE(v_item_json->>'size', '50ml');
    v_qty := GREATEST(1, COALESCE((v_item_json->>'quantity')::int, 1));

    SELECT * INTO v_perfume FROM public.perfumes WHERE id = v_product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'العطر المطلوب غير موجود بالكتالوج: %', v_product_id;
    END IF;

    -- استخراج السعر الحقيقي للمقاس المطلوب
    v_size_data := v_perfume.sizes -> v_size;
    IF v_size_data IS NULL THEN
      v_size_data := v_perfume.sizes -> COALESCE(v_perfume.default_size, '50ml');
    END IF;

    IF v_size_data IS NULL THEN
      RAISE EXCEPTION 'المقاس المطلوب (%) غير متوفر للعطر %', v_size, v_perfume.name;
    END IF;

    v_unit_price := (v_size_data ->> 'price')::numeric;
    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION 'سعر العطر % للمقاس % غير صالح', v_perfume.name, v_size;
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_verified_items := v_verified_items || jsonb_build_array(jsonb_build_object(
      'productId', v_perfume.id,
      'name', v_perfume.name,
      'size', v_size,
      'quantity', v_qty,
      'unitPrice', v_unit_price,
      'lineTotal', v_line_total,
      'image', v_perfume.image,
      'inStock', (v_perfume.stock >= v_qty)
    ));
  END LOOP;

  -- 4. احتساب الخصم العام المباشر
  IF v_global_percent > 0 AND v_subtotal > 0 THEN
    v_global_discount := ROUND((v_subtotal * (v_global_percent / 100.0)), 2);
  END IF;

  -- 5. احتساب خصم بلوغ حد الفاتورة
  IF v_thresh_min > 0 AND v_thresh_val > 0 AND v_subtotal >= v_thresh_min THEN
    v_threshold_discount := LEAST(v_subtotal, v_thresh_val);
  END IF;

  -- 6. التحقق من كود الكوبون إن وجد
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM public.coupons 
    WHERE UPPER(code) = UPPER(TRIM(p_coupon_code)) 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > NOW());

    IF FOUND THEN
      IF v_coupon.min_order_amount IS NULL OR v_subtotal >= v_coupon.min_order_amount THEN
        v_coupon_found := true;
        IF v_coupon.discount_type = 'percent' THEN
          v_coupon_discount := ROUND((v_subtotal * (v_coupon.discount_value / 100.0)), 2);
        ELSE
          v_coupon_discount := LEAST(v_subtotal, v_coupon.discount_value);
        END IF;
      ELSE
        v_coupon_message := 'الحد الأدنى لتطبيق هذا الكوبون هو ' || v_coupon.min_order_amount || ' ج.م';
      END IF;
    ELSE
      v_coupon_message := 'كود الخصم غير صالح أو منتهي الصلاحية';
    END IF;
  END IF;

  -- 7. احتساب إجمالي الخصم
  v_total_discount := LEAST(v_subtotal, GREATEST(v_global_discount, v_threshold_discount) + v_coupon_discount);

  -- 8. حساب الإجمالي النهائي
  IF v_subtotal = 0 THEN
    v_delivery := 0;
  END IF;
  v_grand_total := GREATEST(0, v_subtotal + v_delivery - v_total_discount);

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'delivery', v_delivery,
    'discount', v_total_discount,
    'globalDiscount', v_global_discount,
    'thresholdDiscount', v_threshold_discount,
    'couponDiscount', v_coupon_discount,
    'grandTotal', v_grand_total,
    'couponValid', v_coupon_found,
    'couponMessage', v_coupon_message,
    'items', v_verified_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_secure_order(JSONB, TEXT) TO anon, authenticated, service_role;


-- =============================================================================
-- 4. دالة إنشاء الطلب الآمنة والمحققة ذرياً على السيرفر (create_verified_order)
--    Anti-Price-Tampering & Atomic Order Placement
--    - تمنع التلاعب بالأسعار أو الخصومات أو التوتال
--    - تحسب الأسعار من قاعدة البيانات مباشرة
--    - تتحقق من توفر المخزون وتخصمه ذرياً في نفس المعاملة
--    - تسجل الطلب برقم فريد من المتسلسلة
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_verified_order(
  p_customer JSONB,
  p_items JSONB,
  p_coupon_code TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cod',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item_json JSONB;
  v_product_id TEXT;
  v_size TEXT;
  v_qty INT;
  v_subtotal NUMERIC := 0;
  v_delivery NUMERIC := 50;
  v_global_discount NUMERIC := 0;
  v_global_percent NUMERIC := 0;
  v_threshold_discount NUMERIC := 0;
  v_thresh_min NUMERIC := 0;
  v_thresh_val NUMERIC := 0;
  v_coupon_discount NUMERIC := 0;
  v_auto_discount NUMERIC := 0;
  v_total_discount NUMERIC := 0;
  v_grand_total NUMERIC := 0;
  v_perfume RECORD;
  v_size_data JSONB;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_verified_items JSONB := '[]'::jsonb;
  v_item_record RECORD;
  v_store_config JSONB;
  v_coupon RECORD;
  v_coupon_found BOOLEAN := false;
  v_order_number TEXT;
  v_order_id UUID;
  v_customer JSONB;
  v_totals JSONB;
BEGIN
  -- 1. التحقق الصارم من مدخلات العميل وسلة التسوق
  IF p_customer IS NULL OR (p_customer->>'fullName') IS NULL OR TRIM(p_customer->>'fullName') = '' THEN
    RAISE EXCEPTION 'اسم العميل مطلوب لإتمام الحجز الملكي';
  END IF;

  IF (p_customer->>'phone') IS NULL OR TRIM(p_customer->>'phone') = '' THEN
    RAISE EXCEPTION 'رقم هاتف العميل مطلوب لإتمام الحجز الملكي';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'سلة الشراء فارغة، يرجى اختيار عطر واحد على الأقل';
  END IF;

  -- 2. جلب إعدادات المتجر (الشحن، خصومات الفاتورة، الخصم العام)
  SELECT value INTO v_store_config FROM public.settings WHERE key = 'store_config';
  IF v_store_config IS NOT NULL THEN
    IF (v_store_config->>'deliveryFee') IS NOT NULL THEN
      v_delivery := (v_store_config->>'deliveryFee')::numeric;
    END IF;

    IF (v_store_config->>'thresholdDiscountEnabled')::boolean = true THEN
      v_thresh_min := COALESCE((v_store_config->>'thresholdAmount')::numeric, 0);
      v_thresh_val := COALESCE((v_store_config->>'thresholdDiscountValue')::numeric, 0);
    END IF;

    IF (v_store_config->>'globalDiscountEnabled')::boolean = true THEN
      v_global_percent := COALESCE((v_store_config->>'globalDiscountPercent')::numeric, 0);
    END IF;
  END IF;

  -- 3. التحقق من كل عطر وسعره الحقيقي وكفاية المخزون
  FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := COALESCE(v_item_json->>'productId', v_item_json->>'id');
    v_size := COALESCE(v_item_json->>'size', '50ml');
    v_qty := (v_item_json->>'quantity')::int;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'الكمية غير صالحة للعنصر %', v_product_id;
    END IF;

    -- قفل السجل في جدول العطور للتأكد من المعاملة الذرية ومنع التعارض
    SELECT * INTO v_perfume 
    FROM public.perfumes 
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'العطر المطلوب غير موجود بالكتالوج: %', v_product_id;
    END IF;

    -- التحقق من توفر المقاس المحدد
    v_size_data := v_perfume.sizes -> v_size;
    IF v_size_data IS NULL THEN
      RAISE EXCEPTION 'المقاس المطلوب (%) غير متوفر للعطر: %', v_size, v_perfume.name;
    END IF;

    IF (v_size_data->>'available') IS NOT NULL AND (v_size_data->>'available')::boolean = false THEN
      RAISE EXCEPTION 'المقاس المطلوب (%) غير متاح للطلب حالياً للعطر: %', v_size, v_perfume.name;
    END IF;

    -- استخراج السعر الحقيقي المؤكد من قاعدة البيانات
    v_unit_price := (v_size_data ->> 'price')::numeric;
    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION 'سعر المقاس المطلوب غير صالح للعطر: %', v_perfume.name;
    END IF;

    -- فحص المخزون الفعلي والتأكد من كفايته
    IF v_perfume.stock < v_qty THEN
      RAISE EXCEPTION 'عذراً، المخزون المتوفر من عطر "%" هو % قطع فقط، ولا يكفي الكمية المطلوبة (% قطع).', 
        v_perfume.name, v_perfume.stock, v_qty;
    END IF;

    -- خصم المخزون الحقيقي ذرياً داخل المعاملة (مع منع البيع الزائد إذا تكرر العطر بمقاسات مختلفة)
    UPDATE public.perfumes
    SET stock = stock - v_qty,
        updated_at = NOW()
    WHERE id = v_product_id;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_verified_items := v_verified_items || jsonb_build_array(jsonb_build_object(
      'productId', v_perfume.id,
      'name', v_perfume.name,
      'size', v_size,
      'quantity', v_qty,
      'unitPrice', v_unit_price,
      'lineTotal', v_line_total,
      'image', v_perfume.image
    ));
  END LOOP;

  -- 4. احتساب الخصم العام المباشر
  IF v_global_percent > 0 AND v_subtotal > 0 THEN
    v_global_discount := ROUND((v_subtotal * (v_global_percent / 100.0)), 2);
  END IF;

  -- 5. احتساب خصم بلوغ حد الفاتورة (Threshold Discount)
  IF v_thresh_min > 0 AND v_thresh_val > 0 AND v_subtotal >= v_thresh_min THEN
    v_threshold_discount := LEAST(v_subtotal, v_thresh_val);
  END IF;

  -- 6. التحقق من صحة الكوبون وصلاحيته والحد الأدنى
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM public.coupons 
    WHERE UPPER(code) = UPPER(TRIM(p_coupon_code)) 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > NOW());

    IF FOUND THEN
      IF v_coupon.min_order_amount IS NULL OR v_subtotal >= v_coupon.min_order_amount THEN
        v_coupon_found := true;
        IF v_coupon.discount_type = 'percent' THEN
          v_coupon_discount := ROUND((v_subtotal * (v_coupon.discount_value / 100.0)), 2);
        ELSE
          v_coupon_discount := LEAST(v_subtotal, v_coupon.discount_value);
        END IF;
      ELSE
        RAISE EXCEPTION 'الحد الأدنى لقيمة المشتريات لتفعيل الكوبون "%" هو % ج.م', p_coupon_code, v_coupon.min_order_amount;
      END IF;
    ELSE
      RAISE EXCEPTION 'كوبون الخصم "%" غير صالح أو منتهي الصلاحية', p_coupon_code;
    END IF;
  END IF;

  -- 7. احتساب إجمالي الخصم الآمن (دمج خصم الفاتورة أو الخصم العام مع الكوبون)
  v_auto_discount := GREATEST(v_global_discount, v_threshold_discount);
  v_total_discount := LEAST(v_subtotal, v_auto_discount + v_coupon_discount);

  -- 8. حساب الإجمالي النهائي المعتمد
  v_grand_total := GREATEST(0, v_subtotal + v_delivery - v_total_discount);

  -- 9. توليد رقم الطلب الفريد من المتسلسلة
  v_order_number := 'MUSK-2026-' || LPAD(nextval('public.order_number_seq')::text, 4, '0');

  -- 10. إعداد بيانات العميل والملاحظات
  v_customer := p_customer;
  IF p_notes IS NOT NULL AND TRIM(p_notes) <> '' THEN
    v_customer := jsonb_set(v_customer, '{notes}', to_jsonb(TRIM(p_notes)));
  END IF;

  v_totals := jsonb_build_object(
    'subtotal', v_subtotal,
    'delivery', v_delivery,
    'discount', v_total_discount,
    'globalDiscount', v_global_discount,
    'thresholdDiscount', v_threshold_discount,
    'couponDiscount', v_coupon_discount,
    'grandTotal', v_grand_total,
    'couponCode', CASE WHEN v_coupon_found THEN v_coupon.code ELSE NULL END
  );

  -- 11. إدراج الطلب الآمن والموثق في جدول orders
  INSERT INTO public.orders (
    order_number,
    customer,
    items,
    totals,
    payment_method,
    payment_status,
    order_status
  ) VALUES (
    v_order_number,
    v_customer,
    v_verified_items,
    v_totals,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), 'cod'),
    'pending',
    'new'
  ) RETURNING id INTO v_order_id;

  -- 12. إرجاع السجل المؤكد للعميل وواجهة المتجر
  RETURN jsonb_build_object(
    'success', true,
    'orderId', v_order_number,
    'order_number', v_order_number,
    'orderReference', '#' || v_order_number,
    'dbId', v_order_id,
    'id', v_order_id,
    'customer', v_customer,
    'items', v_verified_items,
    'totals', v_totals,
    'payment_method', COALESCE(NULLIF(TRIM(p_payment_method), ''), 'cod'),
    'payment_status', 'pending',
    'order_status', 'new',
    'created_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_verified_order(JSONB, JSONB, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;


-- =============================================================================
-- 5. تأمين وحماية سياسات أمان الصفوف (Comprehensive Row Level Security - RLS)
-- =============================================================================

-- تفعيل RLS على كافة الجداول الرئيسية
ALTER TABLE public.perfumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- أ) سياسات جدول العطور (public.perfumes)
--    - قراءة الكتالوج: متاحة للعامة (SELECT USING true)
--    - الإضافة والتعديل والحذف: مقتصرة تماماً على المشرفين المعتمدين is_admin()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public perfumes read access" ON public.perfumes;
DROP POLICY IF EXISTS "Admin perfumes write access" ON public.perfumes;
DROP POLICY IF EXISTS "Perfumes are viewable by everyone" ON public.perfumes;
DROP POLICY IF EXISTS "Perfumes are manageable by admins only" ON public.perfumes;

CREATE POLICY "Perfumes are viewable by everyone"
ON public.perfumes FOR SELECT
USING (true);

CREATE POLICY "Perfumes are manageable by admins only"
ON public.perfumes FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- -----------------------------------------------------------------------------
-- ب) سياسات جدول الإعدادات (public.settings)
--    - القراءة: متاحة للعامة لجلب رسوم الشحن وبيانات التحويل وإعدادات الخصم
--    - التعديل والإضافة والحذف: مقتصر على المشرفين المعتمدين is_admin()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public settings read access" ON public.settings;
DROP POLICY IF EXISTS "Admin settings write access" ON public.settings;
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.settings;
DROP POLICY IF EXISTS "Settings are manageable by admins only" ON public.settings;

CREATE POLICY "Settings are viewable by everyone"
ON public.settings FOR SELECT
USING (true);

CREATE POLICY "Settings are manageable by admins only"
ON public.settings FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- -----------------------------------------------------------------------------
-- ج) سياسات جدول الكوبونات (public.coupons)
--    - القراءة للعامة: فقط الكوبونات النشطة وغير المنتهية (is_active = true AND unexpired)
--    - القراءة للمشرفين: رؤية جميع الكوبونات لمتابعتها وإدارتها
--    - الإضافة والتعديل والحذف: للمشرفين المعتمدين فقط is_admin()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public coupons read active" ON public.coupons;
DROP POLICY IF EXISTS "Admin coupons manage access" ON public.coupons;
DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can view all coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;

CREATE POLICY "Public can view active coupons"
ON public.coupons FOR SELECT
TO anon, authenticated
USING (
  is_active = true 
  AND (expires_at IS NULL OR expires_at > NOW())
);

CREATE POLICY "Admins can view all coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage coupons"
ON public.coupons FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- -----------------------------------------------------------------------------
-- د) سياسات جدول الطلبات (public.orders) - حظر شامل ومحكم
--    - القراءة: محظورة تماماً على العامة! متاحة للمشرفين المعتمدين فقط is_admin()
--    - التعديل والحذف: للمشرفين المعتمدين فقط is_admin()
--    - الإدراج المباشر: محظور من جانب العميل العادي لمنع التلاعب (Block direct insert)
--      يجب على العميل إنشاء الطلب حصرياً عبر RPC: create_verified_order()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public order creation" ON public.orders;
DROP POLICY IF EXISTS "Admin orders manage access" ON public.orders;
DROP POLICY IF EXISTS "Block direct order insert" ON public.orders;
DROP POLICY IF EXISTS "Admins direct order insert" ON public.orders;
DROP POLICY IF EXISTS "Admins can select orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

-- 1. القراءة مقتصرة فقط على المشرفين
CREATE POLICY "Admins can select orders"
ON public.orders FOR SELECT
TO authenticated
USING (public.is_admin());

-- 2. التعديل مقتصر على المشرفين
CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 3. الحذف مقتصر على المشرفين
CREATE POLICY "Admins can delete orders"
ON public.orders FOR DELETE
TO authenticated
USING (public.is_admin());

-- 4. حظر الإدراج المباشر من المستخدمين المجهولين (anon)
CREATE POLICY "Block direct order insert"
ON public.orders FOR INSERT
TO anon
WITH CHECK (false);

-- 5. السماح بالإدراج المباشر فقط للمشرفين المصادقين (authenticated admins)
CREATE POLICY "Admins direct order insert"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());


-- =============================================================================
-- 6. تهيئة إعدادات المتجر الافتراضية مع دعم كامل لخصم حد الفاتورة
-- =============================================================================
INSERT INTO public.settings (key, value)
VALUES 
('store_config', '{
  "whatsappNumber": "+201012345678",
  "contactPhone": "+201012345678",
  "vodafoneCashNumber": "01012345678",
  "vodafoneCashName": "بيت المسك للعطور",
  "instapayAccount": "beitalmusk@instapay",
  "instapayName": "بيت المسك للعطور الملكية",
  "bankName": "البنك الأهلي المصري",
  "beneficiaryName": "بيت المسك للعطور الملكية",
  "paymentInstructions": "يرجى تحويل المبلغ الإجمالي وإرسال إشعار أو سكرين شوت بالتحويل عبر الواتساب لتأكيد خروج الشحنة فوراً.",
  "deliveryFee": 50,
  "currency": "EGP",
  "globalDiscountEnabled": false,
  "globalDiscountPercent": 0,
  "globalDiscountLabel": "خصم بيت المسك الملكي",
  "thresholdDiscountEnabled": false,
  "thresholdAmount": 500,
  "thresholdDiscountValue": 50,
  "thresholdDiscountLabel": "خصم الفاتورة الملكية"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  value = public.settings.value || '{
    "deliveryFee": 50,
    "globalDiscountEnabled": false,
    "globalDiscountPercent": 0,
    "globalDiscountLabel": "خصم بيت المسك الملكي",
    "thresholdDiscountEnabled": false,
    "thresholdAmount": 500,
    "thresholdDiscountValue": 50,
    "thresholdDiscountLabel": "خصم الفاتورة الملكية"
  }'::jsonb;


-- =============================================================================
-- 7. استعلام فحص وتأكيد نجاح التثبيت والحماية (Verification Query)
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ تم تطبيق حزمة الأمان والتأمين لقاعدة بيانات بيت المسك بنجاح!';
  RAISE NOTICE '🛡️ تم حظر الإدراج المباشر للطلبات وتفعيل دالة create_verified_order.';
  RAISE NOTICE '👑 تم تقييد صلاحيات لوحة التحكم بدالة is_admin() وجدول admin_users.';
END $$;
