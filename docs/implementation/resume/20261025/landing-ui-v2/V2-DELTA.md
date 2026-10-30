# UI V2 — correção mínima da compatibilidade EXIF

Autorizada pelo Root após o peer Gallery. V1 permanece congelada/HOLD; V2 muda somente `tests/features/conheca-content.test.ts`. Os oito outros after são byte iguais à V1, inclusive todo produto, CSS, E2E e briefs.

Gallery tem formato ASCII fechado, diferente do histórico português. A V2 mapeia os oito nomes nominais em duas cenas × dois temas × desktop/mobile e exige scene/route/theme/density do sidecar, Source SHA de 40 caracteres válido e a descrição completa correspondente no EXIF. A alternativa histórica só atende à lista fechada de doze nomes, com as mesmas duas frases antes exigidas. Prompts continuam exigindo captura real. Não há regex global alternativa, conversão das imagens ou mudança no Gallery.

Apply-check do patch base e do delta exit0; nenhuma execução Node, runtime ou captura. Os 17 membros Gallery reais ainda são dependência de integração. Não aplicar UI antes dos assets qualificados. MainHTTP intocado.
