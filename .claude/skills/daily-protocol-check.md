\# Skill: daily-protocol-check



\## Amaç

Her yeni çalışma oturumunda ve her kritik işlemden önce Angora çalışma kurallarını hatırlatmak ve uygulamak.



\## Tetikleyici

\- Yeni oturum başladığında

\- Kullanıcı herhangi bir işlem talep ettiğinde

\- Kod, veri, git veya migration içeren her istekte



\## Adımlar



\### 1. Bağlam Okuma

\- CLAUDE.md dosyasını oku (varsa)

\- .claude/skills/ içindeki diğer skill dosyalarını dikkate al

\- Önceki konuşma geçmişini değerlendir



\### 2. İşlem Sınıflandırması

Kullanıcı isteğini aşağıdaki kategorilerden birine yerleştir:



| # | Tür | Örnekler |

|---|-----|----------|

| 1 | Sadece konuşma / anlama | Soru sormak, açıklama istemek, fikir almak |

| 2 | Kod değişikliği | Dosya düzenleme, yeni bileşen, mantık değişikliği |

| 3 | Veri değişikliği | UPDATE, DELETE, INSERT, veri düzeltme |

| 4 | Git işlemi | commit, push, revert, reset, merge |

| 5 | Supabase / migration | Migration çalıştırma, RPC değişikliği, DROP |



\### 3. Kritik İşlem Kontrolü

Aşağıdaki anahtar kelimelerden biri varsa — dur, işlem yapma:



\- git revert / git reset / git push

\- migration çalıştırma

\- Supabase UPDATE / DELETE / DROP

\- dosya silme

\- çalışan mantığı değiştirme



\### 4. Çıktı Formatı

Her işlem öncesi aşağıdaki formatı kullan:



1\. NE ANLADIM

&#x20;  Kullanıcının isteğini kendi cümlelerinle yaz.



2\. İŞLEM TİPİ

&#x20;  5 kategoriden hangisi olduğunu belirt.



3\. ETKİLENECEK YERLER

&#x20;  - Hangi dosyalar?

&#x20;  - Hangi tablolar / RPC'ler?

&#x20;  - Hangi sayfalar / paneller?



4\. RİSK

&#x20;  Geri dönüşü var mı? Veri kaybı riski var mı? Yan etki var mı?



5\. ONAY GEREKİYOR MU?

&#x20;  Evet / Hayır — gerekçesiyle.



6\. ONAY BEKLİYORUM

&#x20;  Tip 1 değilse onay gelmeden tek satır dokunma.



\### 5. Uygulama Modu

Kullanıcı açıkça "başla", "devam et", "hepsini yap", "bitene kadar sorma" derse

ve kapsam net şekilde onaylandıysa — aynı iş paketi içinde tekrar tekrar onay isteme.

İş bitince kısa rapor ver.



\### 6. Kritik Komut İstisnası Yok

Kullanıcı genel onay verse bile aşağıdaki işlemlerde ayrıca açık onay al:

\- git revert / git reset / git push

\- Supabase UPDATE / DELETE / DROP

\- migration çalıştırma

Genel "başla" onayı bu işlemleri kapsamaz.



\## Kesin Kurallar

\- Anladığını anlat, onay al, onay gelmeden başlama.

\- Tek noktayı değil, aynı mantığın geçtiği TÜM yerleri listele.

\- Tahmin yürütme — önce gerçek veriyi/kodu oku.

\- Kapsam genişletme.

\- Düzelttim demeden önce doğrula.

\- Şüphen varsa açıkça söyle.



\## Yapılmaması Gerekenler

\- Onaysız kod, veri, git, migration işlemi yapmak.

\- Tahmin yürüterek büyük ihtimal şöyledir demek.

\- Tek sayfaya özel yama yapıp geçmek.

\- Kapsamı sessizce genişletmek.

\- Hata yutmak.

