# SESMOD AI API

SESMOD AI STUDIO için kendi kontrolümüzde, açık kaynak modellerle geliştirilen API katmanı.

## Aşamalar

1. **API gateway:** Supabase Edge Function üzerinden oturum doğrulama ve tek API giriş noktası.
2. **Üretim kuyruğu:** İş kayıtları, durum takibi ve kullanıcı bazlı hız sınırı.
3. **Müzik motoru:** ACE-Step 1.5 modelini ayrı bir Python worker üzerinde çalıştırma.
4. **Dosya teslimi:** Üretilen ses dosyasını Supabase Storage'a yükleme.
5. **Kredi:** Kredi yalnızca üretim başarıyla tamamlanıp dosya kaydı doğrulandıktan sonra düşülür.

## Güvenlik kuralları

- İstemciye service-role anahtarı, model erişim anahtarı veya yönetici sırrı konulmaz.
- Kullanıcı kimliği yalnızca doğrulanmış Supabase oturumundan alınır.
- İstemciden gelen user_id değerine güvenilmez.
- Üretim başarısızsa kredi düşülmez.
- Model inference, Supabase Edge Function içinde çalıştırılmaz; Edge Function yalnızca kimlik doğrulama ve iş yönlendirme katmanı olur.

## İlk fonksiyon

`functions/sesmod-api/index.ts` kimliği doğrulanmış GET isteğinde API durumunu ve modül hazırlık durumlarını döndürür. Bu ilk sürüm henüz ses üretmez.

## Dağıtım notu

Bu kaynak dosya GitHub'a eklenmiştir; Supabase projesine henüz deploy edilmemiştir. Deploy işlemi Supabase CLI veya Dashboard üzerinden ayrıca yapılmalıdır.

## Model seçimi

İlk teknik aday ACE-Step 1.5'tir. Proje deposu MIT lisansını belirtir; ancak üretimde kullanılacak her model checkpoint'inin ayrı model kartı ve ağırlık lisansı ayrıca doğrulanmadan ticari kullanıma açılmamalıdır. GPU ihtiyacı ve ücretsiz barındırma sınırları ayrıca değerlendirilir.
