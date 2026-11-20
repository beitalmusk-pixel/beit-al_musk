-- =============================================================================
-- بيت المسك • BEIT AL-MUSK — Supabase Production Database Schema
-- Complete SQL with Strict Row Level Security (RLS), Admin Auth & Anti-Price-Tampering
-- Version: 2.0.0 (Hardened Production Schema)
-- Target: Supabase PostgreSQL (Postgres 15+)
-- =============================================================================

-- =============================================================================
-- 1. جدول مدراء النظام (admin_users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin', 'manager')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- دالة أمان مركزية للتحقق من هوية المشرف
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- وظيفة مساعدة لربط أو ترقية أي مستخدم في auth.users ليصبح أدمن معتمد
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
    RETURN 'تنبيه: المستخدم غير مسجل بعد في auth.users: ' || p_email;
  END IF;

  INSERT INTO public.admin_users (user_id, email, role)
  VALUES (v_user_id, LOWER(TRIM(p_email)), 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  RETURN 'تم تعيين المستخدم كأدمن بنجاح: ' || p_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_admin_by_email(TEXT) TO authenticated, service_role;

-- مزامنة تلقائية لبريد الإدارة عند إنشاء المستخدم
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF LOWER(NEW.email) IN ('beitalmusk@gmail.com', 'beitalmusk.store@gmail.com', 'admin@beitalmusk.com', 'admin@baytalmusk.com', 'support@beitalmusk.com') 
     OR NEW.email ILIKE '%beitalmusk%' THEN
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
    RAISE NOTICE 'Notice: auth.users trigger skipped (can use add_admin_by_email): %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.admin_users (user_id, email, role)
    SELECT id, LOWER(email), 'admin'
    FROM auth.users
    WHERE LOWER(email) IN ('beitalmusk@gmail.com', 'beitalmusk.store@gmail.com', 'admin@beitalmusk.com', 'admin@baytalmusk.com', 'support@beitalmusk.com')
       OR email ILIKE '%admin%'
       OR email ILIKE '%beitalmusk%'
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice: auth.users auto-sync skipped: %', SQLERRM;
  END;
END $$;


-- =============================================================================
-- 2. جدول العطور والكتالوج (perfumes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.perfumes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'بيت المسك • BEIT AL-MUSK',
  subtitle TEXT DEFAULT 'Extrait de Parfum',
  category TEXT DEFAULT 'عطور ملكية',
  gender TEXT DEFAULT 'للجنسين',
  podium TEXT DEFAULT 'men', -- 'men' أو 'women'
  podium_title TEXT,
  concentration TEXT DEFAULT '34% تركيز نقي',
  stock INTEGER DEFAULT 15 CHECK (stock >= 0),
  default_size TEXT DEFAULT '50ml',
  sizes JSONB NOT NULL DEFAULT '{"30ml": {"price": 165, "available": true}, "50ml": {"price": 245, "available": true}, "100ml": {"price": 360, "available": true}}'::jsonb,
  notes JSONB NOT NULL DEFAULT '{"top": ["مسك أبيض"], "heart": ["ورد طائفي"], "base": ["عود كمبودي"]}'::jsonb,
  description TEXT,
  story TEXT,
  visual JSONB,
  image TEXT DEFAULT 'assets/logo.jpg',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- =============================================================================
-- 3. متسلسلة أرقام الطلبات الفريدة (Order Sequence)
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1520 INCREMENT BY 1;


-- =============================================================================
-- 4. جدول طلبات العملاء (orders)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT ('MUSK-2026-' || LPAD(nextval('public.order_number_seq')::text, 4, '0')),
  customer JSONB NOT NULL, -- { fullName, phone, address, notes }
  items JSONB NOT NULL,    -- array of items [{ productId, name, size, quantity, unitPrice, lineTotal }]
  totals JSONB NOT NULL,   -- { subtotal, delivery, discount, grandTotal, thresholdDiscount, couponDiscount }
  payment_method TEXT NOT NULL, -- 'cod', 'vodafone_cash', 'instapay'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed'
  order_status TEXT DEFAULT 'new',      -- 'new', 'processing', 'shipped', 'completed', 'cancelled'
  whatsapp_sent BOOLEAN DEFAULT false,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- =============================================================================
-- 5. جدول إعدادات المتجر وبيانات الدفع (settings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- =============================================================================
-- 6. جدول كوبونات الخصم (coupons)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' أو 'fixed'
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);


-- =============================================================================
-- 7. حماية المخزون وإلغاء التريجر المزدوج القديم
-- =============================================================================
-- ملاحظة أمنية: يتم إلغاء التريجر القديم لمنع خصم المخزون مرتين،
-- حيث أصبحت دالة create_verified_order تتولى فحص وخصم المخزون ذرياً.
DROP TRIGGER IF EXISTS trg_deduct_inventory ON public.orders;


-- =============================================================================
-- 8. دالة حساب الأسعار والخصومات الآمنة (calculate_secure_order)
--    تدعم: التحقق من أسعار الكتالوج + خصم حد الفاتورة + الخصم العام + الكوبونات
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
  v_delivery NUMERIC := 50; -- الشحن الافتراضي 50 ج
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
  -- التحقق من السلة
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

  -- استخراج إعدادات المتجر
  SELECT value INTO v_store_config FROM public.settings WHERE key = 'store_config';
  IF v_store_config IS NOT NULL THEN
    IF (v_store_config->>'deliveryFee') IS NOT NULL THEN
      v_delivery := (v_store_config->>'deliveryFee')::numeric;
    END IF;

    -- خصم بلوغ حد الفاتورة
    IF (v_store_config->>'thresholdDiscountEnabled')::boolean = true THEN
      v_thresh_min := COALESCE((v_store_config->>'thresholdAmount')::numeric, 0);
      v_thresh_val := COALESCE((v_store_config->>'thresholdDiscountValue')::numeric, 0);
    END IF;

    -- الخصم العام المباشر
    IF (v_store_config->>'globalDiscountEnabled')::boolean = true THEN
      v_global_percent := COALESCE((v_store_config->>'globalDiscountPercent')::numeric, 0);
    END IF;
  END IF;

  -- التحقق من الأسعار الحقيقية من جدول perfumes
  FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := COALESCE(v_item_json->>'productId', v_item_json->>'id');
    v_size := COALESCE(v_item_json->>'size', '50ml');
    v_qty := GREATEST(1, COALESCE((v_item_json->>'quantity')::int, 1));

    SELECT * INTO v_perfume FROM public.perfumes WHERE id = v_product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'العطر المطلوب غير موجود بالكتالوج: %', v_product_id;
    END IF;

    -- استخراج السعر الحقيقي للمقاس من قاعدة البيانات
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

  -- احتساب الخصم العام
  IF v_global_percent > 0 AND v_subtotal > 0 THEN
    v_global_discount := ROUND((v_subtotal * (v_global_percent / 100.0)), 2);
  END IF;

  -- احتساب خصم حد الفاتورة
  IF v_thresh_min > 0 AND v_thresh_val > 0 AND v_subtotal >= v_thresh_min THEN
    v_threshold_discount := LEAST(v_subtotal, v_thresh_val);
  END IF;

  -- التحقق من الكوبون
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
        v_coupon_message := 'الحد الأدنى لتطبيق الكوبون هو ' || v_coupon.min_order_amount || ' ج.م';
      END IF;
    ELSE
      v_coupon_message := 'كود الخصم غير صالح أو منتهي الصلاحية';
    END IF;
  END IF;

  v_total_discount := LEAST(v_subtotal, GREATEST(v_global_discount, v_threshold_discount) + v_coupon_discount);

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
-- 9. دالة إنشاء الطلب المؤكدة والذرية على السيرفر (create_verified_order)
--    Anti-Price-Tampering & Atomic Order Placement
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
  -- التحقق من بيانات العميل
  IF p_customer IS NULL OR (p_customer->>'fullName') IS NULL OR TRIM(p_customer->>'fullName') = '' THEN
    RAISE EXCEPTION 'اسم العميل مطلوب لإتمام الحجز الملكي';
  END IF;

  IF (p_customer->>'phone') IS NULL OR TRIM(p_customer->>'phone') = '' THEN
    RAISE EXCEPTION 'رقم هاتف العميل مطلوب لإتمام الحجز الملكي';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'سلة الشراء فارغة، يرجى اختيار عطر واحد على الأقل';
  END IF;

  -- إعدادات المتجر
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

  -- التحقق من الأسعار والمقاسات والمخزون
  FOR v_item_json IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := COALESCE(v_item_json->>'productId', v_item_json->>'id');
    v_size := COALESCE(v_item_json->>'size', '50ml');
    v_qty := (v_item_json->>'quantity')::int;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'الكمية غير صالحة للعنصر %', v_product_id;
    END IF;

    -- قفل السجل في جدول العطور للمعاملة الذرية
    SELECT * INTO v_perfume 
    FROM public.perfumes 
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'العطر المطلوب غير موجود بالكتالوج: %', v_product_id;
    END IF;

    v_size_data := v_perfume.sizes -> v_size;
    IF v_size_data IS NULL THEN
      RAISE EXCEPTION 'المقاس المطلوب (%) غير متوفر للعطر: %', v_size, v_perfume.name;
    END IF;

    IF (v_size_data->>'available') IS NOT NULL AND (v_size_data->>'available')::boolean = false THEN
      RAISE EXCEPTION 'المقاس المطلوب (%) غير متاح للطلب حالياً للعطر: %', v_size, v_perfume.name;
    END IF;

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

  -- الخصم العام
  IF v_global_percent > 0 AND v_subtotal > 0 THEN
    v_global_discount := ROUND((v_subtotal * (v_global_percent / 100.0)), 2);
  END IF;

  -- خصم حد الفاتورة
  IF v_thresh_min > 0 AND v_thresh_val > 0 AND v_subtotal >= v_thresh_min THEN
    v_threshold_discount := LEAST(v_subtotal, v_thresh_val);
  END IF;

  -- التحقق من الكوبون
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

  v_auto_discount := GREATEST(v_global_discount, v_threshold_discount);
  v_total_discount := LEAST(v_subtotal, v_auto_discount + v_coupon_discount);
  v_grand_total := GREATEST(0, v_subtotal + v_delivery - v_total_discount);

  v_order_number := 'MUSK-2026-' || LPAD(nextval('public.order_number_seq')::text, 4, '0');

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

  -- إدراج الطلب الآمن
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
-- 10. تفعيل وتطبيق سياسات أمان الصفوف (Row Level Security - RLS)
-- =============================================================================
ALTER TABLE public.perfumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 1. سياسات العطور (perfumes):
-- القراءة متاحة للجميع بالكامل
DROP POLICY IF EXISTS "Public perfumes read access" ON public.perfumes;
DROP POLICY IF EXISTS "Admin perfumes write access" ON public.perfumes;
DROP POLICY IF EXISTS "Perfumes are viewable by everyone" ON public.perfumes;
DROP POLICY IF EXISTS "Perfumes are manageable by admins only" ON public.perfumes;

CREATE POLICY "Perfumes are viewable by everyone" 
ON public.perfumes FOR SELECT 
USING (true);

-- التعديل والإضافة والحذف مقتصر تماماً على المشرفين المعتمدين is_admin()
CREATE POLICY "Perfumes are manageable by admins only" 
ON public.perfumes FOR ALL 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- 2. سياسات الإعدادات (settings):
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

-- 3. سياسات الكوبونات (coupons):
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

-- 4. سياسات الطلبات (orders):
DROP POLICY IF EXISTS "Public order creation" ON public.orders;
DROP POLICY IF EXISTS "Admin orders manage access" ON public.orders;
DROP POLICY IF EXISTS "Block direct order insert" ON public.orders;
DROP POLICY IF EXISTS "Admins direct order insert" ON public.orders;
DROP POLICY IF EXISTS "Admins can select orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

-- القراءة والتحديث والحذف للمشرفين فقط (حظر كامل على قراءة العامة للطلبات)
CREATE POLICY "Admins can select orders" 
ON public.orders FOR SELECT 
TO authenticated 
USING (public.is_admin());

CREATE POLICY "Admins can update orders" 
ON public.orders FOR UPDATE 
TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete orders" 
ON public.orders FOR DELETE 
TO authenticated 
USING (public.is_admin());

-- حظر الإدراج المباشر من العامة، إجبار الإنشاء عبر create_verified_order
CREATE POLICY "Block direct order insert" 
ON public.orders FOR INSERT 
TO anon 
WITH CHECK (false);

CREATE POLICY "Admins direct order insert" 
ON public.orders FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin());

-- 5. سياسات جدول المشرفين (admin_users):
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


-- =============================================================================
-- 11. بيانات المتجر الأولية الافتراضية (Default Settings & Seed)
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

-- إدراج العطور الأربعة الملكية الحصرية
INSERT INTO public.perfumes (id, name, brand, subtitle, category, gender, podium, podium_title, concentration, stock, default_size, sizes, notes, description, story, image)
VALUES
(
  'sokoon',
  'عطر سكون (Sokoon)',
  'بيت المسك • BEIT AL-MUSK',
  'لمسة من السحر والأنوثة لكل لحظة',
  'زهري ناعم ومسكي',
  'نسائي ناعم (Pour Femme)',
  'women',
  'الجناح النسائي 🌸',
  'ماء عطر مكثف • Eau de Parfum Intense',
  15,
  '50ml',
  '{"30ml": {"price": 165, "label": "30 مل", "available": true}, "50ml": {"price": 245, "label": "50 مل", "available": true}, "100ml": {"price": 360, "label": "100 مل", "available": true}}'::jsonb,
  '{"top": ["برغموت", "فانيلا"], "heart": ["ياسمين", "ورد"], "base": ["عنبر", "مسك أبيض"]}'::jsonb,
  'عطر سكون: لمسة من السحر والأنوثة لكل لحظة. افتتاحية منعشة ومشرقة من البرغموت الإيطالي ولمسات الفانيلا المخملية، ينساب برقة إلى قلب زهري آسر مفعم بالياسمين وبتلات الورد الأبيض، ليستقر على قاعدة دافئة ومترفة من العنبر والمسك الأبيض الفاخر.',
  'صُمم عطر سكون في معمل بيت المسك ليكون رفيق كل لحظة أنثوية هادئة ومميزة؛ يمنحك هالة من النقاء والرقة التي تترك بصمة ساحرة وأثراً لا يُنسى أينما حللت.',
  'assets/products/sokoon.jpg'
),
(
  'moon-night',
  'مون نايت (Moon Night)',
  'بيت المسك • BEIT AL-MUSK',
  'سحر الليالي الآسرة بالمسك والعنبر والتوت الفاخر',
  'فاكهي وزهري ليلي فخم',
  'رجالي فاخر (Pour Homme)',
  'men',
  'الجناح الرجالي 👑',
  'خلاصة عطرية ملكية • Extrait de Parfum 32%',
  11,
  '50ml',
  '{"30ml": {"price": 195, "label": "30 مل", "available": true}, "50ml": {"price": 285, "label": "50 مل", "available": true}, "100ml": {"price": 440, "label": "100 مل", "available": true}}'::jsonb,
  '{"top": ["توت بري وبلاك بيري", "رازبيري مع بشر حمضيات"], "heart": ["الياسمين", "البنفسج"], "base": ["العنبر والأخشاب", "المسك والفانيليا"]}'::jsonb,
  'عطر مون نايت يجسد غموض وجاذبية الليل الفاتن. يبتدئ بانفجار فاكهي غني ومبهج من التوت البري والرازبيري والبلاك بيري وبشر الحمضيات، يتناغم بسحر مع باقة زهرية مخملية من الياسمين والبنفسج، ويتكئ على عرش فاخر من العنبر والأخشاب النبيلة مع دفء المسك والفانيليا.',
  'مستوحى من سحر القمر في سماء ليلة شرقية دافئة؛ حيث تتعانق نسائم البنفسج والزهور الليلية النادرة مع عبير التوت البري وأخشاب الغابات ودهن مسك بيت المسك المعتق.',
  'assets/products/moon-night.jpg'
),
(
  'miss-allure',
  'ميس ألور (Miss Allure)',
  'بيت المسك • BEIT AL-MUSK',
  'فيض الأنوثة بالورد الجوري والفراولة البرية والمسك الناعم',
  'زهري فاكهي ساحر',
  'نسائي ساحر (Pour Femme)',
  'women',
  'الجناح النسائي 🌸',
  'ماء عطر مكثف • Eau de Parfum 28%',
  14,
  '50ml',
  '{"30ml": {"price": 180, "label": "30 مل", "available": true}, "50ml": {"price": 265, "label": "50 مل", "available": true}, "100ml": {"price": 390, "label": "100 مل", "available": true}}'::jsonb,
  '{"top": ["توت العليق الأسود", "فراولة برية"], "heart": ["ورد جوري وورد تركي", "ياسمين ملكي وزنبق الوادي"], "base": ["مسك ناعم", "فانيليا مدغشقرية"]}'::jsonb,
  'عطر ميس ألور من بيت المسك، تحفة فنية تنبض بالجاذبية والرقة الملكية. يفتتح العطر بعبير الفراولة البرية وتوت العليق الأسود، يتعانق مع قلب أسطوري من الورد الجوري والورد التركي والياسمين الملكي وزنبق الوادي، ويستقر على قاعدة مخملية من المسك الناعم والفانيليا المدغشقرية النادرة.',
  'حكاية جاذبية لا تُقاوم؛ صُمم ميس ألور ليكون توقيع المرأة الواثقة المفعمة بالجمال، حيث تلتقي نفحات البساتين الفرنسية والورود الشرقية بأفخم درجات المسك الناعم والفانيليا المدغشقرية.',
  'assets/products/miss-allure.jpg'
),
(
  'sakura',
  'ساكورا (Sakura)',
  'بيت المسك • BEIT AL-MUSK',
  'سيمفونية زهرية تفيض بالحياة، وتترك أثراً مخملياً ساحراً',
  'زهري نضر ومسكي أبيض',
  'للجنسين والرجال (Unisex & Him)',
  'men',
  'الجناح الرجالي والنيش 👑',
  'خلاصة ملكية نادرة • Extrait de Parfum 30%',
  9,
  '50ml',
  '{"30ml": {"price": 190, "label": "30 مل", "available": true}, "50ml": {"price": 275, "label": "50 مل", "available": true}, "100ml": {"price": 410, "label": "100 مل", "available": true}}'::jsonb,
  '{"top": ["الفاوانيا", "الماندرين (اليوسفي)"], "heart": ["زهر الكرز (ساكورا)", "الزنبق والورد"], "base": ["المسك الأبيض", "العنبر وخشب الصندل"]}'::jsonb,
  'عطر ساكورا من بيت المسك: سيمفونية زهرية تفيض بالحياة، وتترك أثراً مخملياً ساحراً. افتتاحية منعشة من الفاوانيا والماندرين (اليوسفي)، يعقبها قلب أثيري من زهر الكرز والزنبق والورد، تتوجها قاعدة فاخرة من المسك الأبيض النقي، العنبر الذهبي، وخشب الصندل العتيق.',
  'مستوحى من موسم إزهار الكرز الملكي؛ يجسد التجدد والأناقة النقية في قنينة بورسلين بيضاء ناصعة كاللؤلؤ، يعلوها تاج الذهب وأندر قطرات المسك الصافي من بيت المسك.',
  'assets/products/sakura.jpg'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sizes = EXCLUDED.sizes,
  stock = EXCLUDED.stock,
  image = EXCLUDED.image,
  updated_at = NOW();
