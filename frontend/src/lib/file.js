import { t } from './i18n.js'

const IMAGE_MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export function validateImageFile(file, { maxBytes }) {
  if (!file) return { ok: false, code: 'NO_FILE', message: t('validation.noFile') }
  if (!IMAGE_MIME_ALLOWLIST.has(file.type)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_TYPE',
      message: t('validation.unsupportedType'),
    }
  }
  if (maxBytes && file.size > maxBytes) {
    const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: t('validation.fileTooLarge', { max: String(maxMb) }),
    }
  }
  return { ok: true }
}

