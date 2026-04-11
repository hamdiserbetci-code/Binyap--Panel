-- Create ETM firma
INSERT INTO firmalar (ad, aktif) VALUES ('ETM', true) RETURNING id, ad;
