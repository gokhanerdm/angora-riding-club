-- Hizmet sözleşmesi ve KVKK metinleri
CREATE TABLE IF NOT EXISTS public.legal_documents (
  type       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Üyelik sözleşmesi
INSERT INTO public.legal_documents (type, title, content) VALUES (
  'membership_agreement',
  'Angora Binicilik Kulübü Hizmet Sözleşmesi',
  'ANGORA BİNİCİLİK KULÜBÜ HİZMET SÖZLEŞMESİ

KONU
Bu sözleşme, anlaşmada belirtilen şartlar, kapsam ve kursiyerlerin üyeliğinin devam ettiği süre içerisinde, tesisin hizmete açık olduğu sürece kursiyerlerin tesisten satın almış olduğu hizmetten yararlanma hakkını düzenlemektedir.

ÜCRET
Üye, üyelik bedeli kayıt esnasında üye tarafından belirlenen paket ve bu paketlere ait ücretleri nakit veya kart ile peşinen ödemekle yükümlüdür. Tesis çalışma saatlerinde üyenin anlaştığı saatlerde tesis hizmet vermeye hazır bulunduğundan eğitimden yararlanmasa dahi abonelik ücretini ödemek zorundadır.

SÖZLEŞME İPTAL VE İADELERİ
Üyeler sözleşmenin imzalandığı günden başlayarak 7 (yedi) gün içerisinde sözleşmelerini herhangi bir neden belirtmeden iptal edebilir. Bu süre içerisinde üye ders aldıysa o dersin tek ders ücreti üyeden kesilerek geri kalan ücret üyeye iade edilir. Kredi kartı ile yapılan ödemelerde ise iptal söz konusu ise varsa aldığı ders ücreti ile birlikte %20''lik kesinti yapılarak iade edilir. 7 günü geçen süre içerisinde iptal ve iade işlemleri üyelerin isteği ve tesisin onayıyla gerçekleşebilmektedir.

TESİS KURALLARI
Üyeler ve misafirler tesiste bulundukları sürece diğer üyelere, misafirlere ve tesis personeline saygısızlık niteliğindeki kötü harekette bulunmaları, küfür ve argo konuşmaları, alkollü şekilde tesisi kullanmaları, şiddet hareketleri kesinlikle yasaktır. Aksi durumlar herhangi bir ücret iadesi olmaksızın üyeliğin sona ermesini gerektirir. Kayıp eşyalardan tesis sorumlu değildir.

ÜYENİN HAK VE BORÇLARI
Üyeler, üyeliklerinin geçerli olması ve üyelik bedelini tam ve zamanında ödemiş olmaları halinde kulüp tesislerinden yararlanabilirler. Üyeler aldıkları paket dahilinde haftada minimum bir kez gelmek koşuluyla bir gün öncesinden rezervasyon yaptırabilirler. Üye, üyelik süresi içerisinde yaşanabilecek sakatlanma, düşme, yaralanma gibi durumlara karşı gerekli güvenlik önlemlerini alarak eğitimini yapacağını; oluşabilecek olumsuz durumlarda kulübün ve antrenörlerin herhangi bir sorumluluğu olmadığını kabul eder.

TESİS HAK VE BORÇLARI
Tesis, mücbir sebep halleri, tadilat ve bakım ile belediye ve hükümet müdahalesi hariç olmak üzere tesisi üyelerin kullanımına hazır halde tutacaktır. Tesis, üyenin almış olduğu eğitim paketi içerisinde antrenörün hastalık, izin veya işten ayrılma durumunda kalan derslerin başka bir antrenör tarafından yapılmasına olanak sağlar.

SON HÜKÜMLER
Bu anlaşmanın uygulanmasından kaynaklanan tüm ihtilaflarda Ankara mahkemeleri ve icra daireleri yetkilidir. İşbu sözleşmeyi okuduğumu, anladığımı ve kabul ettiğimi beyan ederim.'
) ON CONFLICT (type) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW();

-- KVKK Aydınlatma Metni
INSERT INTO public.legal_documents (type, title, content) VALUES (
  'kvkk',
  'Kişisel Verilerin Korunması Kanunu (KVKK) Aydınlatma Metni',
  'ANGORA BİNİCİLİK KULÜBÜ
KİŞİSEL VERİLERİN KORUNMASI KANUNU AYDINLATMA METNİ

Veri Sorumlusu: Angora Binicilik Kulübü

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, kişisel verileriniz aşağıda açıklanan kapsamda işlenmektedir.

1. İŞLENEN KİŞİSEL VERİLER
Ad-soyad, T.C. kimlik numarası, doğum tarihi, iletişim bilgileri (telefon, e-posta, adres), sağlık beyanı, acil iletişim kişisi bilgileri ve ödeme bilgileri.

2. KİŞİSEL VERİLERİN İŞLENME AMACI
• Üyelik sözleşmesinin kurulması ve ifası
• Rezervasyon ve ders takibi
• Üyelik bedellerinin tahsilatı
• Acil durumlarda yetkili kişilere bildirim
• Yasal yükümlülüklerin yerine getirilmesi
• Tesis güvenliğinin sağlanması

3. KİŞİSEL VERİLERİN AKTARILDIĞI TARAFLAR
Kişisel verileriniz; yasal zorunluluk halleri dışında üçüncü kişilerle paylaşılmamaktadır. Ödeme işlemleri için ilgili bankalar ve ödeme kuruluşlarıyla gerekli ölçüde paylaşılabilir.

4. KİŞİSEL VERİLERİN TOPLANMA YÖNTEMİ VE HUKUKİ SEBEBİ
Kişisel verileriniz; üyelik formu, mobil uygulama ve sözlü beyan yoluyla toplanmakta olup sözleşmenin ifası ve meşru menfaat hukuki sebeplerine dayanmaktadır.

5. KİŞİSEL VERİ SAHİBİNİN HAKLARI
KVKK''nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:
• Kişisel verilerinizin işlenip işlenmediğini öğrenme
• İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme
• Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme
• Eksik veya yanlış işlenmesi hâlinde düzeltilmesini isteme
• Silinmesini veya yok edilmesini isteme
• Otomatik sistemler aracılığıyla analiz edilmesi suretiyle aleyhinize sonuç oluşmasına itiraz etme
• Kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme

Haklarınızı kullanmak için kulübümüzle iletişime geçebilirsiniz.'
) ON CONFLICT (type) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW();

-- RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_read_all"  ON public.legal_documents FOR SELECT USING (true);
CREATE POLICY "legal_admin_write" ON public.legal_documents FOR ALL USING (public.get_my_role() = 'admin');
