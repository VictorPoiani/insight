# Níveis de Contribuinte × Insight Nitro

Dois sistemas que não se misturam, com uma única regra ligando os dois:

| | Níveis de Contribuinte | Insight Nitro |
|---|---|---|
| Como se obtém | apoio acumulado (1 R$ = 1 ponto, `donations` → `contributor_level`) | assinatura de **R$ 3,99/mês**, ou **vitalício no Nível 5** |
| O que dá | capacidade: cota de anexos por post, comunidades, tópicos, suporte, IA, cosméticos de patente | só cosméticos, Rainbow, selo, grupo VIP, bônus de IA |
| Código | `src/lib/contributorLevels.ts` | `src/lib/nitro/entitlement.ts` |
| Banco | `contributor_level`, `contributor_upload_limit()` | `nitro_status`, `nitro_expires_at`, `has_lifetime_nitro`, `has_nitro_access()` |

Migração: `supabase/migrations/20261121000000_contributor_perks_nitro.sql`.

## Matriz dos níveis

| Nível | Pontos | Anexos por post (pós-compressão) | Adiciona |
|---|---|---|---|
| 0 Observador | 0 | 50 MB | acesso padrão |
| 1 Recruta | 1 | 400 MB | ranking + mural, moldura cobre, tag |
| 2 Escudeiro | 10 | 800 MB | acesso antecipado, criar comunidades (em breve), moldura prisma |
| 3 Cavaleiro | 50 | 2 GB | criar tópicos personalizados, IA (em breve), moldura ouro |
| 4 Imperador | 100 | 2 GB | suporte prioritário, créditos extras de IA (em breve), moldura safira animada + abertura |
| 5 Grão-Mestre | 250 | 2 GB | **Nitro vitalício**, grupo VIP, moldura singularity animada + abertura |

Admin recebe o teto (2 GB). O Nível 5 continua em **250 pontos**, que é o valor do
banco (`calculate_contributor_level`) e da página de apoio.

## Nitro vitalício no Nível 5

- Trigger `profiles_zz_lifetime_nitro`: quando `contributor_level >= 5`, grava
  `has_lifetime_nitro = true`. Ele nunca volta a `false` (nem com estorno nem pelo
  próprio usuário).
- `has_nitro_access()` e `resolveNitroEntitlement()` também aceitam
  `contributor_level >= 5` direto, sem depender do flag.
- Portão de lançamento: enquanto `public.nitro_is_public()` retorna `false` e
  `NEXT_PUBLIC_INSIGHT_NITRO` não é `public`, o Nitro continua só para admin (beta
  fechada). Para lançar, troque os dois.
- Grupo VIP: o link fica em `nitro_settings` (`key = 'vip_whatsapp_invite'`), sem
  leitura direta. Só `get_nitro_vip_invite()` devolve o link, e só para quem tem Nitro.

```sql
insert into public.nitro_settings (key, value)
values ('vip_whatsapp_invite', 'https://chat.whatsapp.com/…')
on conflict (key) do update set value = excluded.value;
```

- Cobrança (Mercado Pago preapproval): as colunas estão prontas. O webhook deve gravar
  `nitro_status`, `nitro_expires_at` (fim do período pago) e `nitro_subscription_id`
  com a service role. Uma assinatura `canceled` vale até `nitro_expires_at`.

## Cota de anexos medida no R2

O que conta é o **peso final no bucket**, depois da compressão no navegador, somado
entre todas as mídias de um post.

1. **Compositor**: cada bloco guarda `mediaBytes` (o `compressedSize`). A barra mostra,
   por exemplo, `142 MB / 400 MB usados neste post · Nível 1`. O envio é bloqueado se
   a soma passar do limite, e cada upload já nasce com o orçamento que resta.
2. **`/api/upload/r2`**: lê o nível no banco (não no cliente) e chama
   `register_media_upload()`, que recusa qualquer arquivo acima do limite do nível e
   grava o tamanho exato. A URL pré-assinada amarra `Content-Length` e
   `Content-Type`, então o R2 recusa um corpo de outro tamanho. No multipart, cada
   parte é assinada com o tamanho dela, e no final um `HeadObject` confere o total
   (apaga o objeto se não bater).
3. **Trigger `posts_media_quota`**: ao salvar o post, soma o peso registrado de toda
   mídia R2 referenciada nos blocos e recusa acima do limite. Não dá para burlar
   mandando os arquivos de vários rascunhos para o mesmo post.

Tipos que não são mídia segura (HTML, JS, etc.) são servidos como
`application/octet-stream` (download, nunca renderizados no domínio da CDN).

### CORS do bucket `insight-media` (obrigatório para multipart)

```json
[{
  "AllowedOrigins": ["https://<seu-domínio>", "http://localhost:3000"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["content-type"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

Sem `ExposeHeaders: ["ETag"]`, uploads acima de 100 MB falham com uma mensagem clara.

## Diagnóstico da compressão

### Como estava

- O ffmpeg.wasm (core 0.12.6, single-thread) recebia o arquivo **inteiro copiado para
  a memória do wasm** (`writeFile(fetchFile(file))`). Somando a saída e a cópia do
  `readFile`, um vídeo de 600 MB precisava de mais de 1,5 GB de heap. Isso estoura o
  wasm32 e derruba a aba no iOS e no Android.
- O vídeo saía sempre em 720p com CRF 28, sem estimativa de tamanho nem de tempo. Um
  4K de 10 minutos rodaria por horas.
- O listener de progresso só era ligado na primeira carga, então a partir do segundo
  vídeo a barra ficava parada.
- Imagens iam sem compressão para o Supabase Storage (5 MB), e arquivos também. O
  teto era de 25 MB por arquivo, sem cota por post.
- A URL pré-assinada **não amarrava o tamanho**: o limite de 25 MB era checado só sobre
  o número que o cliente informava.

### Como ficou (`src/lib/mediaCompressor.ts`)

| Problema | Mudança |
|---|---|
| Arquivo bruto copiado inteiro para a RAM | A entrada é montada via **WORKERFS** e o FFmpeg lê o `File` sob demanda. A RAM fica só com a saída. |
| Sem previsão | `planVideoCompression()` lê duração e resolução pelo `<video>` e estima tamanho e tempo **antes** do FFmpeg. Ele escolhe a maior resolução (1080p → 720p → 540p) que encoda em até 8 min e um bitrate que cabe no orçamento do post e na memória segura do aparelho (700 MB no desktop, 220 MB no celular). |
| Recompressão desnecessária | Se o vídeo já está em bitrate eficiente (até 1080p) e cabe na cota, sobe o original. |
| Vídeo longo demais para o navegador | Sobe o original se couber na cota; se não couber, recusa com uma mensagem acionável (cortar ou reduzir). |
| Memória do wasm só cresce | `terminate()` depois de jobs pesados. |
| Imagens | Canvas/OffscreenCanvas → **WebP 0,82**, lado máximo de 2560 px (JPEG 0,85 se o navegador não codifica WebP; PNG com transparência é mantido). No teste, uma PNG 4000×3000 de 2,98 MB virou WebP de 1,19 MB. |
| GIFs | Acima de 512 KB viram MP4 H.264 sem áudio (540p, 20 fps), tipicamente 85–95 % menores. |
| Upload | PUT com progresso real (XHR). Acima de 100 MB usa **multipart** em partes de 16 MB, 3 em paralelo, até 3 tentativas por parte. |

### Limites que continuam (e a recomendação)

O x264 em wasm single-thread é o gargalo: cerca de 3–6 fps em 1080p no desktop e de
1–2 fps no celular. Recomprimir 2 GB de vídeo bruto no navegador não é viável. O
caminho para isso é **WebCodecs** (`VideoEncoder` com aceleração de hardware, 10–50×
mais rápido, por exemplo com a biblioteca `mediabunny` para demux/mux), com o
ffmpeg.wasm como reserva para navegadores sem WebCodecs. A outra opção é
transcodificar no servidor (Cloudflare Stream ou um worker com FFmpeg nativo depois
do upload). Enquanto isso, o plano acima evita travar a aba e respeita a cota.
