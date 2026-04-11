-- Finans Merkezindeki tum cari + fatura kayitlarini siler.
-- Dikkat: Bu script destruktiftir. Once yedek alin.

begin;

-- 1) Faturalara bagli satirlar
delete from fin_fatura_satirlari;

-- 2) Cari hareketler (fatura kaynakli + manuel tum hareketler)
delete from fin_cari_hareketler;

-- 3) Faturalar (alis/satis/iade tumu)
delete from fin_faturalar;

-- 4) Cari kartlar
delete from fin_cari_hesaplar;

commit;
