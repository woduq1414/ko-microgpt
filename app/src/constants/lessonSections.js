export const LESSON_SECTIONS_BY_LANG = {
  ko: [
    {
      id: 'lesson-1',
      label: 'CHAPTER 01',
      title: 'DATA',
      description: '이름을 만드는 GPT 모델을 학습시키기 위해, 많은 이름들을 모았어요. 이 이름들이 실제론 문서에 해당해요.',
      points: [
        '한국어 이름 샘플을 모아 학습 데이터셋을 만들어요.',
        '각 이름은 모델이 읽는 하나의 문서(document)예요.',
        '문서 수가 많을수록 이름 패턴을 더 안정적으로 배워요.',
      ],
      takeaway: '데이터 품질이 좋아질수록 생성되는 이름 품질도 좋아져요.',
      bgClass: 'bg-neo-secondary',
    },
    {
      id: 'lesson-2',
      label: 'CHAPTER 02',
      title: 'TOKENIZATION',
      description:
        '모델이 이름을 만드는 방법을 배우게 하기 위해, 이름을 음운(초성·중성·종성)으로 나누고, 각 음운에 고유한 번호(토큰 ID)를 부여해 모델이 읽을 수 있는 형태로 바꿨어요. 이름의 시작과 끝에는 [BOS]라는 특수한 토큰을 추가해 어디가 시작과 끝인지 알려줘요.',
      points: [
        '좌우 화살표로 예시 이름을 바꿔가며 토큰화를 확인해요.',
        '각 음운 토큰에는 모델이 참조하는 고유 번호(token id)가 매핑돼요.',
        'BOS 토큰은 이름 시퀀스가 시작된다는 것을 알려주는 특수 토큰이에요.',
      ],
      takeaway: '이름을 음운 + 번호 시퀀스로 바꾸면, 모델이 계산 가능한 입력으로 이해할 수 있어요.',
      bgClass: 'bg-neo-muted',
    },
    {
      id: 'lesson-3',
      label: 'CHAPTER 03',
      title: 'EMBEDDING',
      description: '토큰 임베딩과 위치 임베딩을 더해 모델 입력 임베딩을 만듭니다. 어떤 음운이 어느 위치에 놓였는지에 따라 최종 벡터가 달라집니다.',
      points: [
        '각 토큰은 길이 16의 숫자 벡터(토큰 임베딩)로 변환돼요.',
        '현재 위치도 길이 16의 벡터(위치 임베딩)로 표현돼요.',
        '두 벡터를 같은 차원끼리 더한 값이 모델 입력이 돼요.',
      ],
      takeaway: '같은 음운이라도 위치가 바뀌면 입력 임베딩이 달라집니다.',
      bgClass: 'bg-white',
    },
    {
      id: 'lesson-4',
      label: 'CHAPTER 04',
      title: 'ATTENTION',
      description:
        '선택한 예시 이름와 인덱스를 기준으로 Final Embedding(x)에서 Q, K, V를 만들어 Attention Output을 계산하고, 최종적으로 다음 토큰으로 어떤 토큰이 나올 지 확률을 계산합니다.',
      points: [
        'Query 위치를 고르면 해당 위치의 Q를 기준으로 과거 토큰들과의 유사도를 계산해요.',
        'K는 정보의 주소, V는 실제로 가져올 내용을 나타내요.',
        'softmax로 정규화한 가중치로 V를 합치면 최종 Attention Output이 됩니다.',
      ],
      takeaway: 'Attention은 현재 위치가 필요한 과거 정보를 선택적으로 모아오는 연산입니다.',
      bgClass: 'bg-neo-muted',
    },
    {
      id: 'lesson-5',
      label: 'CHAPTER 05',
      title: 'LOSS AND GRADIENT',
      description:
        '각 POS에서 정답 토큰이 나올 확률을 통해 예측과 정답의 차이(손실, loss)를 산출합니다. 각 파라미터(보라색 박스)가 이 손실에 기여하는 정도(gradient)를 역전파(backpropagation)를 통해 계산할 수 있습니다.',
      points: [
        'POS 0부터 마지막 음운 예측 POS까지 next token 확률을 순서대로 확인해요.',
        '각 POS마다 정답 토큰 주변 5개 확률만 세로 리스트로 보여줘요.',
        '아래에서 POS별 token loss와 평균 loss를 함께 확인해요.',
      ],
      takeaway: '학습은 각 POS의 정답 확률을 높이는 방향으로 평균 loss를 줄이는 과정입니다.',
      bgClass: 'bg-white',
    },
    {
      id: 'lesson-6',
      label: 'CHAPTER 06',
      title: 'TRAINING',
      description: '각 파라미터가 손실에 기여하는 정도(gradient)를 활용하여, 모델은 손실을 줄이는 방향으로 반복적으로 파라미터를 조정해나가며 학습합니다.',
      points: [
        'step preset(50/100/500/1000)으로 학습 구간을 선택하고 0부터 재생해요.',
        'pause, reset, 슬라이더로 원하는 step 상태를 직접 확인해요.',
        '선택한 파라미터의 gradient와 업데이트된 16차원 값을 한 번에 비교해요.',
      ],
      takeaway: '표현은 단순한 수식이지만, 실제 값은 Adam 업데이트를 따릅니다.',
      bgClass: 'bg-neo-muted',
    },
    {
      id: 'lesson-7',
      label: 'CHAPTER 07',
      title: 'INFERENCE',
      description:
        '학습된 모델을 이용해 실제로 새로운 이름을 만듭니다. 각 POS에서 얻은 다음 토큰 확률 분포에서 랜덤으로 토큰을 뽑아 음운을 순차적으로 생성합니다.',
      points: [
        '상단 큐에 생성된 이름을 최대 10개까지 저장하고 클릭해 비교해요.',
        'Temperature 슬라이더로 샘플링 분포를 조절해 이름 다양성을 확인해요.',
        '선택한 이름의 POS별 next token probability와 샘플 토큰을 재생해요.',
      ],
      takeaway: '추론은 학습된 확률 분포에서 다음 토큰을 순차적으로 샘플링하는 과정입니다.',
      bgClass: 'bg-neo-secondary',
    },
    {
      id: 'lesson-8',
      label: 'CHAPTER 08',
      title: 'REAL GPT',
      description:
        'microgpt(이 사이트에서 다루고 있는 모델)는 GPT의 알고리즘 뼈대를 보여주는 간소화된 버전이고, real GPT는 같은 원리를 대규모 데이터·하드웨어·후처리 파이프라인으로 확장한 시스템입니다.',
      points: [
        {
          topic: '데이터',
          similarity: '둘 다 다음에 나올 토큰을 예측하는 목적으로 텍스트 분포를 학습하며, 데이터 품질이 모델 품질을 크게 좌우합니다.',
          difference: 'microgpt는 소규모 이름 데이터셋을 다루지만 real GPT는 웹·도서·코드 등 조 단위의 토큰 규모 코퍼스를 중복 제거, 품질 필터링, 도메인 믹싱 후 학습합니다.',
        },
        {
          topic: '토큰화',
          similarity: '둘 다 문자열을 정수 토큰 시퀀스로 변환한 뒤 임베딩으로 바꿉니다.',
          difference: 'microgpt는 문자(음운) 단위 토큰화로 수 십개 정도의 vocabulary를 사용하지만, real GPT는 BPE 계열 subword tokenizer를 사용해 약 10만 개 내외 vocabulary를 사용합니다.',
        },
        {
          topic: '임베딩',
          similarity: '둘 다 token embedding과 position 정보를 결합해 Transformer 입력 표현을 만듭니다.',
          difference: 'microgpt는 저차원 dense embedding 중심이지만 real GPT는 고차원 임베딩, RoPE(회전 위치 인코딩), 정규화/스케일링 전략을 결합해 긴 문맥 안정성을 높입니다.',
        },
        {
          topic: '모델 구조',
          similarity: '둘 다 Attention과 MLP, 잔차 연결이 활용 된 Transformer 블록 구조를 공유합니다.',
          difference: 'microgpt는 수천 파라미터·1개 레이어 수준이고, real GPT는 수천억 파라미터·수백 개 레이어로 확장되며 GQA, gated activation, MoE 같은 최적화 블록이 추가됩니다.',
        },
        {
          topic: '학습 방식',
          similarity: '둘 다 loss를 최소화하도록 역전파와 Adam 계열 optimizer로 파라미터를 업데이트합니다.',
          difference: 'real GPT는 대규모 pretraining 이후 post-training(SFT, RLHF/RLAIF 계열 preference optimization)을 거쳐 지시 수행 능력·응답 품질·안전성 정렬을 강화합니다.',
        },
        {
          topic: '추론',
          similarity: '둘 다 autoregressive decoding으로 다음 토큰을 한 스텝씩 생성합니다.',
          difference: 'real GPT는 대규모 동시 요청을 처리하기 위해 batching, KV cache paging, quantization, speculative decoding, multi-GPU 분산 서빙을 결합한 별도 inference stack이 필요합니다.',
        },
      ],
      bgClass: 'bg-white',
    },
  ],
  en: [
    {
      id: 'lesson-1',
      label: 'CHAPTER 01',
      title: 'DATA',
      description:
        'To train a GPT model that generates names, we collected many names. In this context, each name works like a document.',
      points: [
        'We collect Korean name samples to build a training dataset.',
        'Each name is one document read by the model.',
        'More documents help the model learn name patterns more stably.',
      ],
      takeaway: 'As data quality improves, generated name quality improves too.',
      bgClass: 'bg-neo-secondary',
    },
    {
      id: 'lesson-2',
      label: 'CHAPTER 02',
      title: 'TOKENIZATION',
      description:
        'To let the model learn how names are formed, each name is split into phoneme units (initial, medial, final), and each unit is mapped to a unique token ID so the model can process it. A special [BOS] token is added at the start and end to mark boundaries.',
      points: [
        'Use left/right arrows to switch example names and inspect tokenization.',
        'Each phoneme token is mapped to a unique token id used by the model.',
        'The BOS token is a special marker indicating sequence boundaries.',
      ],
      takeaway: 'Converting names into phoneme + id sequences makes them computable model inputs.',
      bgClass: 'bg-neo-muted',
    },
    {
      id: 'lesson-3',
      label: 'CHAPTER 03',
      title: 'EMBEDDING',
      description:
        'The model input embedding is built by adding token embedding and position embedding. The final vector changes depending on which phoneme appears at which position.',
      points: [
        'Each token is converted to a 16-dimensional numeric vector (token embedding).',
        'The current position is also represented as a 16-dimensional vector (position embedding).',
        'The model input is the element-wise sum of these two vectors.',
      ],
      takeaway: 'Even the same phoneme gets a different input embedding when position changes.',
      bgClass: 'bg-white',
    },
    {
      id: 'lesson-4',
      label: 'CHAPTER 04',
      title: 'ATTENTION',
      description:
        'Given the selected example name and index, we compute Q, K, and V from Final Embedding (x), derive Attention Output, and finally calculate the probability of each possible next token.',
      points: [
        'Choose a Query position to compute similarity against previous tokens.',
        'K represents addresses of information, and V represents the actual content to retrieve.',
        'Applying softmax weights and combining V gives the final Attention Output.',
      ],
      takeaway: 'Attention selectively gathers relevant past information for the current position.',
      bgClass: 'bg-neo-muted',
    },
    {
      id: 'lesson-5',
      label: 'CHAPTER 05',
      title: 'LOSS AND GRADIENT',
      description:
        'At each POS, we compare prediction and target token probability to compute loss. We then compute how much each parameter contributes to that loss via backpropagation (gradient).',
      points: [
        'Inspect next-token probabilities from POS 0 to the final prediction POS in order.',
        'For each POS, only five probabilities around the target token are shown in a vertical list.',
        'Review per-POS token loss and mean loss together below.',
      ],
      takeaway: 'Training is the process of lowering mean loss by raising target-token probability at each POS.',
      bgClass: 'bg-white',
    },
    {
      id: 'lesson-6',
      label: 'CHAPTER 06',
      title: 'TRAINING',
      description:
        'Using each parameter\'s gradient contribution to loss, the model learns by repeatedly updating parameters in the direction that reduces loss.',
      points: [
        'Choose a training range with step presets (50/100/500/1000) and replay from step 0.',
        'Use pause, reset, and slider controls to inspect any step state directly.',
        'Compare the selected parameter\'s gradient and updated 16D values side by side.',
      ],
      takeaway: 'The formula is simple, but actual values follow Adam updates.',
      bgClass: 'bg-neo-muted',
    },
    {
      id: 'lesson-7',
      label: 'CHAPTER 07',
      title: 'INFERENCE',
      description:
        'With the trained model, we generate new names by sampling tokens from next-token probability distributions at each POS and building phonemes sequentially.',
      points: [
        'Store up to 10 generated names in the top queue and click to compare them.',
        'Adjust the Temperature slider to observe diversity changes in sampling.',
        'Replay per-POS next-token probabilities and sampled tokens for the selected name.',
      ],
      takeaway: 'Inference samples next tokens step by step from learned probability distributions.',
      bgClass: 'bg-neo-secondary',
    },
    {
      id: 'lesson-8',
      label: 'CHAPTER 08',
      title: 'REAL GPT',
      description:
        'microgpt (the model covered on this site) is a simplified version that exposes GPT\'s algorithmic skeleton, while real GPT scales the same principles with massive data, hardware, and post-processing pipelines.',
      points: [
        {
          topic: 'Data',
          similarity: 'Both learn text distributions to predict the next token, and data quality strongly impacts model quality.',
          difference: 'microgpt uses a small name dataset, while real GPT trains on trillion-scale corpora from web/books/code after deduplication, quality filtering, and domain mixing.',
        },
        {
          topic: 'Tokenization',
          similarity: 'Both convert strings into integer token sequences and then embeddings.',
          difference: 'microgpt uses character/phoneme-level tokenization with a small vocabulary, while real GPT uses BPE-family subword tokenizers with around ~100k vocabulary.',
        },
        {
          topic: 'Embedding',
          similarity: 'Both combine token embedding and position information into transformer input representations.',
          difference: 'microgpt focuses on low-dimensional dense embeddings, while real GPT combines high-dimensional embeddings, RoPE, and normalization/scaling strategies for long-context stability.',
        },
        {
          topic: 'Model Architecture',
          similarity: 'Both share transformer blocks built from Attention, MLP, and residual connections.',
          difference: 'microgpt is around thousands of parameters and one layer, while real GPT scales to hundreds of billions of parameters and hundreds of layers with optimizations like GQA, gated activations, and MoE.',
        },
        {
          topic: 'Training Method',
          similarity: 'Both update parameters through backpropagation and Adam-family optimizers to minimize loss.',
          difference: 'real GPT uses post-training (SFT and preference optimization such as RLHF/RLAIF) after large-scale pretraining to improve instruction-following, response quality, and safety alignment.',
        },
        {
          topic: 'Inference',
          similarity: 'Both generate tokens autoregressively one step at a time.',
          difference: 'real GPT requires a separate large-scale inference stack combining batching, KV cache paging, quantization, speculative decoding, and multi-GPU distributed serving.',
        },
      ],
      bgClass: 'bg-white',
    },
  ],
}
