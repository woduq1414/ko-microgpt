export const CHOSEONG_COMPAT = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
export const JUNGSEONG_COMPAT = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ']
export const JONGSEONG_COMPAT = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
export const HANGUL_SYLLABLE_START = 0xac00
export const HANGUL_SYLLABLE_END = 0xd7a3

export const LAYER_DEPTHS = [1, 1.6, 2.2]
export const CHAPTER_TWO_LAYER_DEPTHS = [0.65, 1.0, 1.35]
export const ROTATION_STEPS = [-6, -3, -1, 1, 3, 6]
export const SIZE_CLASSES = ['text-base', 'text-lg', 'text-xl']
export const EXAMPLE_NAMES_BY_LANG = {
  ko: ['시연', '민준', '나영', '지혜', '승민', '하율', '아희', '유성'],
  en: ['EMMA', 'OLIVIA', 'LIAM', 'DOROTHY', 'JAMES', 'EMILY', 'LUCAS', 'LOGAN'],
}
export const CHAPTER_TWO_BG_BASE_TOKENS_BY_LANG = {
  ko: [...CHOSEONG_COMPAT, ...JUNGSEONG_COMPAT],
  en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
}
export const EMBEDDING_POSITIVE_BASE = '#e9fce9'
export const EMBEDDING_POSITIVE_STRONG = '#22c55e'
export const EMBEDDING_NEGATIVE_BASE = '#feeaea'
export const EMBEDDING_NEGATIVE_STRONG = '#ef4444'
export const ATTENTION_HIDDEN_PLACEHOLDER = '····'
export const LOGIT_PARTIAL_COMMIT_STEP = 2
export const CHAPTER_SIX_DEFAULT_STEP_OPTIONS = [50, 100, 500, 1000]
export const CHAPTER_SIX_AUTOPLAY_INTERVAL_MS = 30
export const CHAPTER_SIX_FLOW_DURATION_SCALE = 1
export const CHAPTER_SIX_LOSS_CHART_WIDTH = 320
export const CHAPTER_SIX_LOSS_CHART_HEIGHT = 104
export const CHAPTER_SEVEN_QUEUE_LIMIT = 10
export const CHAPTER_SEVEN_MIN_TEMPERATURE = 0.1
export const CHAPTER_SEVEN_MAX_TEMPERATURE = 1.5
export const CHAPTER_SEVEN_DEFAULT_TEMPERATURE = 0.5
export const CHAPTER_SEVEN_TEMPERATURE_STEP = 0.1
export const CHAPTER_SEVEN_EMPTY_RETRY_LIMIT = 24
export const CHAPTER_SEVEN_PHASE_SPEED_MULTIPLIER = 2.4
export const CHAPTER_SEVEN_PHASE_INPUT_MS = Math.round(320 / CHAPTER_SEVEN_PHASE_SPEED_MULTIPLIER)
export const CHAPTER_SEVEN_PHASE_PROB_MS = Math.round(420 / CHAPTER_SEVEN_PHASE_SPEED_MULTIPLIER)
export const CHAPTER_SEVEN_PHASE_SAMPLE_MS = Math.round(380 / CHAPTER_SEVEN_PHASE_SPEED_MULTIPLIER)
export const CHAPTER_SEVEN_PHASE_HOLD_MS = Math.round(220 / CHAPTER_SEVEN_PHASE_SPEED_MULTIPLIER)
export const CHAPTER_SEVEN_QUEUE_STAGGER_MS = 140
export const CHAPTER_SEVEN_QUEUE_ENTER_ANIM_MS = 320
