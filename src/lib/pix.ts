function normalizeAscii(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

function formatField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16CCITT(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txid = 'INSIGHT',
  description,
}: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number | null;
  txid?: string;
  description?: string;
}): string {
  const cleanKey = pixKey.trim();
  const cleanName = normalizeAscii(merchantName, 25) || 'INSIGHT';
  const cleanCity = normalizeAscii(merchantCity, 15) || 'BRASIL';
  const cleanTxid =
    txid
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 25) || '***';

  let merchantAccountInfo =
    formatField('00', 'br.gov.bcb.pix') + formatField('01', cleanKey);

  if (description) {
    const cleanDesc = normalizeAscii(description, 35);
    if (cleanDesc) {
      merchantAccountInfo += formatField('02', cleanDesc);
    }
  }

  let payload = '';
  payload += formatField('00', '01'); // Payload Format Indicator
  payload += formatField('26', merchantAccountInfo); // Merchant Account Information
  payload += formatField('52', '0000'); // Merchant Category Code
  payload += formatField('53', '986'); // Currency: BRL

  if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
    payload += formatField('54', amount.toFixed(2));
  }

  payload += formatField('58', 'BR'); // Country Code
  payload += formatField('59', cleanName); // Merchant Name
  payload += formatField('60', cleanCity); // Merchant City
  payload += formatField('62', formatField('05', cleanTxid)); // Additional Data (txid)
  payload += '6304'; // CRC16 header

  return payload + crc16CCITT(payload);
}

export function getPixQrImageUrl(pixPayload: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&ecc=M&data=${encodeURIComponent(
    pixPayload
  )}`;
}