-- =============================================================================
-- بيت المسك • BEIT AL-MUSK — Supabase Production Database Schema
-- Complete SQL with Row Level Security (RLS) & Triggers
-- =============================================================================

-- 1. جدول العطور والكتالوج (perfumes)
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

-- 2. متسلسلة أرقام الطلبات الفريدة (Order Sequence)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1520 INCREMENT BY 1;

-- 3. جدول طلبات العملاء (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT ('MUSK-2026-' || LPAD(nextval('public.order_number_seq')::text, 4, '0')),
  customer JSONB NOT NULL, -- { fullName, phone, address, notes }
  items JSONB NOT NULL,    -- array of items [{ productId, name, size, quantity, unitPrice }]
  totals JSONB NOT NULL,   -- { subtotal, delivery, discount, grandTotal }
  payment_method TEXT NOT NULL, -- 'cod', 'vodafone_cash', 'instapay'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed'
  order_status TEXT DEFAULT 'new',      -- 'new', 'processing', 'shipped', 'completed', 'cancelled'
  whatsapp_sent BOOLEAN DEFAULT false,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. جدول إعدادات المتجر وبيانات الدفع (settings)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. جدول كوبونات الخصم (coupons)
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
-- دالة خصم المخزون تلقائياً عند تأكيد الطلب
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
BEGIN
  -- المرور على كل عنصر في الطلب وخصم كميته من المخزون
  FOR item IN SELECT * FROM jsonb_to_recordset(NEW.items) AS (productId TEXT, quantity INT)
  LOOP
    UPDATE public.perfumes
    SET stock = GREATEST(0, stock - item.quantity),
        updated_at = NOW()
    WHERE id = item.productId;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deduct_inventory ON public.orders;
CREATE TRIGGER trg_deduct_inventory
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.process_order_inventory();

-- =============================================================================
-- دالة حساب السعر والكوبون الآمنة على السيرفر (RPC Function)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_secure_order(
  p_items JSONB,
  p_coupon_code TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_subtotal NUMERIC := 0;
  v_delivery NUMERIC := 50; -- الشحن الثابت 50 ج
  v_discount NUMERIC := 0;
  v_grand_total NUMERIC := 0;
  v_perfume RECORD;
  v_verified_items JSONB := '[]'::jsonb;
  v_size_price NUMERIC;
  v_coupon RECORD;
BEGIN
  -- التحقق من الأسعار الحقيقية من جدول perfumes
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS ("productId" TEXT, "size" TEXT, "quantity" INT)
  LOOP
    SELECT * INTO v_perfume FROM public.perfumes WHERE id = v_item."productId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'العطر المطلوب غير موجود بالكتالوج: %', v_item."productId";
    END IF;

    -- استخراج السعر الحقيقي للمقاس من قاعدة البيانات
    v_size_price := (v_perfume.sizes -> v_item."size" ->> 'price')::numeric;
    IF v_size_price IS NULL THEN
      v_size_price := (v_perfume.sizes -> '50ml' ->> 'price')::numeric;
    END IF;

    v_subtotal := v_subtotal + (v_size_price * v_item."quantity");
    v_verified_items := v_verified_items || jsonb_build_object(
      'productId', v_perfume.id,
      'name', v_perfume.name,
      'size', v_item."size",
      'quantity', v_item."quantity",
      'unitPrice', v_size_price,
      'lineTotal', (v_size_price * v_item."quantity")
    );
  END LOOP;

  -- التحقق من الكوبون في حال وجوده
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM public.coupons 
    WHERE UPPER(code) = UPPER(TRIM(p_coupon_code)) 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > NOW());

    IF FOUND THEN
      IF v_coupon.discount_type = 'percent' THEN
        v_discount := ROUND((v_subtotal * (v_coupon.discount_value / 100.0)), 2);
      ELSE
        v_discount := LEAST(v_subtotal, v_coupon.discount_value);
      END IF;
    END IF;
  END IF;

  v_grand_total := v_subtotal + v_delivery - v_discount;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'delivery', v_delivery,
    'discount', v_discount,
    'grandTotal', v_grand_total,
    'items', v_verified_items
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- تفعيل أمان الصفوف (Row Level Security - RLS)
-- =============================================================================
ALTER TABLE public.perfumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 1. سياسات العطور (perfumes):
-- القراءة متاحة للجميع (العملاء والزوار)
CREATE POLICY "Public perfumes read access" 
ON public.perfumes FOR SELECT USING (true);

-- التعديل والإضافة والحذف مقتصر فقط على الأدمن المسجل
CREATE POLICY "Admin perfumes write access" 
ON public.perfumes FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. سياسات الطلبات (orders):
-- أي عميل يستطيع إرسال طلب جديد
CREATE POLICY "Public order creation" 
ON public.orders FOR INSERT 
WITH CHECK (true);

-- قراءة وتعديل الطلبات مقتصر على الأدمن المسجل فقط (حماية خصوصية العملاء)
CREATE POLICY "Admin orders manage access" 
ON public.orders FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. سياسات الإعدادات (settings):
-- القراءة متاحة للجميع لمعرفة أرقام التحويل والشحن
CREATE POLICY "Public settings read access" 
ON public.settings FOR SELECT USING (true);

-- التعديل للأدمن فقط
CREATE POLICY "Admin settings write access" 
ON public.settings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. سياسات الكوبونات (coupons):
-- القراءة للنشط فقط
CREATE POLICY "Public coupons read active" 
ON public.coupons FOR SELECT USING (is_active = true);

-- التعديل للأدمن فقط
CREATE POLICY "Admin coupons manage access" 
ON public.coupons FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- =============================================================================
-- بيانات المتجر الأولية الافتراضية (Default Settings & Perfumes Seed)
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
  "globalDiscountPercent": 0
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

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
