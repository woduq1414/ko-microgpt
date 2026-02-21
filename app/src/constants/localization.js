export const SUPPORTED_LANGUAGES = ['ko', 'en']
export const LANG_COOKIE_KEY = 'microgpt_lang'
export const LANG_COOKIE_MAX_AGE = 31536000

const normalizeLanguage = (value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : null
}

export const detectDefaultLanguage = () => {
  if (typeof navigator === 'undefined') {
    return 'en'
  }
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export const readLanguageCookie = () => {
  if (typeof document === 'undefined') {
    return null
  }

  const cookieChunks = document.cookie ? document.cookie.split(';') : []
  for (const chunk of cookieChunks) {
    const [rawName, ...rawValueParts] = chunk.trim().split('=')
    if (rawName !== LANG_COOKIE_KEY) {
      continue
    }
    const decodedValue = decodeURIComponent(rawValueParts.join('='))
    const language = normalizeLanguage(decodedValue)
    if (language) {
      return language
    }
  }

  return null
}

export const writeLanguageCookie = (language) => {
  const normalizedLanguage = normalizeLanguage(language)
  if (!normalizedLanguage || typeof document === 'undefined') {
    return
  }

  document.cookie = `${LANG_COOKIE_KEY}=${encodeURIComponent(normalizedLanguage)}; max-age=${LANG_COOKIE_MAX_AGE}; path=/; samesite=lax`
}

export const COPY_BY_LANG = {
  ko: {
    hero: {
      languageSwitchAria: '언어 선택',
      openProjectInfoAria: '프로젝트 정보 열기',
      closeProjectInfoAria: '프로젝트 정보 닫기',
      intro: '한국어 이름 생성 GPT가 어떻게 데이터를 읽고, 새로운 이름을 생성하는 지 알아볼까요?',
      startFromData: 'Start From Data',
      goToGithub: 'Go To Github',
      projectInfoTitle: 'PROJECT INFO',
      projectInfoStart: '이 프로젝트는 ',
      projectInfoMiddle: '의 ',
      projectInfoMicrogptLinkText: 'microgpt 프로젝트',
      projectInfoEnd: '를 기반으로, 한국어 이름을 생성하는 GPT 모델의 내부 동작 과정을 시각화 한 프로젝트입니다.',
      projectInfoGithub: 'Go To Github of this website',
    },
    roles: {
      initial: '초성',
      medial: '중성',
      final: '종성',
      other: '기타',
      sequenceStart: '시퀀스 시작',
      sequenceEnd: '시퀀스 끝',
    },
    chapterOne: {
      corePointsLabel: '핵심 포인트',
      takeawayLabel: 'Takeaway',
    },
    chapterEight: {
      similarityLabel: '공통점:',
      differenceLabel: '차이점:',
    },
    outro: {
      message: '한국어 이름을 만드는 microgpt의 과정에 대해 전부 알아보셨습니다!',
      backToTop: '처음으로 돌아가기',
      goToGithub: 'Go To Github',
    },
    footer: {
      next: 'NEXT: API 연결 후 인터랙티브 퀴즈 섹션 추가',
      buildNextModule: 'Build Next Module',
    },
    chapter2: {
      prevExampleNameAria: '이전 예시 이름 보기',
      nextExampleNameAria: '다음 예시 이름 보기',
      selectedTokenTitle: '현재 선택 토큰',
      roleLabel: '역할',
      syllableLabel: '음절',
      noSelectedTokenMessage: '아직 선택된 토큰이 없어요. 토큰을 클릭하면 여기에 선택 정보가 표시됩니다.',
      tokenChipAria: (display, role, tokenId) => `${display} ${role} token id ${tokenId}`,
    },
    chapter3: {
      samplePhonemeTitle: '예시 음운',
      prevPhonemeAria: '이전 음운',
      nextPhonemeAria: '다음 음운',
      positionIndexTitle: '위치 인덱스',
      prevPositionIndexAria: '이전 위치 인덱스',
      nextPositionIndexAria: '다음 위치 인덱스',
      conceptAria: (title) => `${title} 개념 설명`,
      tokenEmbeddingInfoBody: '음운 자체 의미를 담는 벡터입니다.',
      positionEmbeddingInfoBody:
        '토큰이 시퀀스의 몇 번째인지 알려주는 벡터입니다. 왜 토큰의 위치 정보를 임베딩하는 걸까요? 이는 모델이 시퀀스의 순서를 인식하고, 이전 토큰들의 정보를 참고할 수 있게 도와주기 때문입니다.',
      sumEmbeddingInfoBody:
        '토큰 임베딩과 위치 임베딩을 차원별로 더한 중간 입력입니다. 이 벡터는 토큰과 위치의 정보를 모두 반영한 결과로, 모델이 토큰과 위치를 동시에 고려할 수 있게 해줍니다.',
      finalEmbeddingInfoBody:
        '합 벡터를 RMSNorm으로 스케일링한 최종 입력입니다. 이 과정을 통해 벡터의 크기를 1로 만들고, 모델의 학습 안정성을 높이는 역할을 합니다.',
    },
    chapter4: {
      conceptAria: (title) => `${title} 개념 설명`,
      exampleNameTitle: '예시 이름',
      prevExampleNameAria: '이전 예시 이름',
      nextExampleNameAria: '다음 예시 이름',
      targetIndexTitle: '타겟 인덱스',
      prevTargetIndexAria: '이전 예시 인덱스',
      nextTargetIndexAria: '다음 예시 인덱스',
      replayAria: 'Attention 계산 애니메이션 다시 재생',
      skipAria: 'Chapter 4 애니메이션 생략 모드 토글',
      finalEmbeddingInfoBody: '현재 Query 위치의 Final Embedding 벡터입니다. Q, K, V를 만드는 재료가 됩니다.',
      qkvInfoBody:
        'Q는 Query, K는 Key, V는 Value를 나타냅니다. 비유하자면, Q는 궁금증(질문), K는 정보가 저장된 책장(주소), V는 책장의 실제 내용(정보)과 같습니다. 즉, Q를 들고서 여러 책장(K)을 둘러보고 Q와 K가 얼마나 관련이 있는 지 생각하고, 필요한 내용을(V) 관련이 있는 만큼 꺼내오는 과정입니다. Q/K/V는 Final Embedding(X)을 통해 계산됩니다.',
      attentionWeightsInfoBody: 'Q·K 점수를 softmax한 확률 분포 벡터입니다. 이 벡터는 각 POS의 K가 Q와 얼마나 연관성이 있는지를 나타냅니다.',
      attentionOutputInfoBody: '각 POS의 V에 Attention Weight를 곱해 누적한 결과입니다. 이 벡터는 현재 위치에서 과거 위치들의 정보를 종합적으로 반영한 결과입니다.',
      headOutputsInfoBody:
        '상단에서 head0에 대한 Attention Output을 구했습니다. 사실, GPT에서는 여러 개의 head를 사용해 보다 다양한 관점에서 정보(Attention Output)를 추출하고자 합니다. 본 예제에서는 4개 head output을 결합(concat)해 Multi-Head Attention 입력(x_attn)을 만듭니다.',
      multiHeadOutputInfoBody: 'x_attn(16차원)에 W_O를 곱해 Multi-Head Attention Output을 만듭니다.',
      attentionBlockResultInfoBody:
        'Final Embedding(x)와 Multi-Head Attention Output을 더한 결과 벡터입니다. 이와 같이 이전 데이터를 잔차 연결(residual connection)을 통해 더해주면 모델의 학습 안정성을 높일 수 있어요.',
      transformerBlockOutputInfoBody:
        'Attention Block Result를 입력으로 MLP(Multi Layer Perceptron : rmsnorm → fc1 → relu → fc2 → residual)를 적용한 트랜스포머 블럭의 최종 출력 벡터입니다.',
      logitInfoBody:
        'Transformer Block Output에 선형 변환을 적용해 토큰 별 점수(높을수록 다음 토큰이 될 확률이 높음)를 계산합니다. 전체 vocab에 대해 계산하고, 여기에는 상위 10개와 하위 2개만 표시합니다.',
      nextTokenProbabilityInfoBody: 'logit 전체에 softmax를 적용해 다음 토큰이 나올 확률 분포를 만든 결과입니다.',
    },
    chapter5: {
      unavailable: '학습 시퀀스를 만들 수 없어 표시할 데이터가 없습니다.',
      exampleNameTitle: '예시 이름',
      prevExampleNameAria: '이전 예시 이름 보기',
      nextExampleNameAria: '다음 예시 이름 보기',
      targetIndexTitle: '타겟 인덱스',
      prevTargetIndexAria: '이전 타겟 인덱스 보기',
      nextTargetIndexAria: '다음 타겟 인덱스 보기',
      replayAria: 'Chapter 5 애니메이션 다시 재생',
      skipAria: 'Chapter 5 애니메이션 생략 모드 토글',
      nextTokenProbAria: 'POS별 next token probability',
      correctLabel: (label) => `정답: ${label}`,
      tokenLossAria: 'POS별 token loss',
      meanLossAria: '평균 loss',
      backpropSummaryLabel: '중략 설명',
      backpropSummaryText: '중략: Block Output에서 Sum Embedding까지의 내부 연산도 동일한 체인 룰로 역전파됩니다.',
    },
    chapter6: {
      unavailable: 'Chapter 6 시각화 데이터를 표시할 수 없습니다.',
      targetStepTitle: '목표 Step 선택',
      prevTargetStepAria: '이전 목표 step 선택',
      nextTargetStepAria: '다음 목표 step 선택',
      progressStepTitle: '진행 Step',
      prevStepAria: '이전 step으로 한 칸 이동',
      stepSliderAria: (currentStep, targetStep) => `학습 step 선택 슬라이더. 현재 ${currentStep}, 최대 ${targetStep}`,
      nextStepAria: '다음 step으로 한 칸 이동',
      togglePlayAria: (isPlaying) => (isPlaying ? '학습 일시 중지' : '학습 재개'),
      startAria: '학습 시작',
      resetAria: '학습 진행 초기화',
      currentWordAria: '현재 학습 단어',
      currentLossAria: '현재 loss',
      lossTrendAria: 'step별 loss 추이',
      lossTrendGraphAria: 'step별 loss 꺾은선 그래프',
      lossTrendEmpty: 'loss 데이터가 아직 없습니다.',
      parameterUpdateAria: '파라미터 업데이트 수식',
      exampleParameterTitle: '예시 파라미터',
      prevParameterAria: '이전 파라미터 선택',
      nextParameterAria: '다음 파라미터 선택',
      learningRateHelpAria: 'Learning Rate 설명 보기',
      learningRateHelpText:
        'Learning rate는 gradient를 파라미터에 얼마나 크게 반영할지 정하는 스텝 크기입니다. 값이 크면 빠르게 움직이지만 불안정해질 수 있고, 작으면 안정적이지만 학습이 느려집니다. 이 예제에서 Learning rate는 step이 진행됨에 따라 자동으로 감소(decay)합니다.',
    },
    chapter7: {
      unavailable: 'Chapter 7 추론 데이터를 표시할 수 없습니다.',
      queueAria: '이름 큐',
      queuePathAria: (name) => `${name} 생성 경로 보기`,
      queueEmpty: '이름을 생성하면 여기에 쌓입니다.',
      generateOneAria: '이름 1개 생성하기',
      generateOneText: '1개 생성하기',
      generateTenAria: '이름 10개 생성하기',
      generateTenText: '10개 생성하기',
      temperatureHelpAria: 'Temperature 설명 보기',
      temperatureHelpText:
        '값이 낮을수록 안전하고 반복적인 토큰을 고르고, 높을수록 다양한 토큰을 고릅니다. Temperature가 과도하게 높으면 제대로 된 이름을 만들지 못할 수 있어요.',
      temperatureDownAria: 'temperature 낮추기',
      temperatureSliderAria: (temperature, min, max) =>
        `Temperature 슬라이더. 현재 ${temperature}. 최소 ${min}, 최대 ${max}`,
      temperatureUpAria: 'temperature 높이기',
      prevPosAria: '이전 POS 보기',
      nextPosAria: '다음 POS 보기',
      tokenViewAria: (tokenIndex) => `${tokenIndex}번째 token 보기`,
      sampledMeta: (rank, prob) => `rank #${rank} · prob ${prob}`,
    },
    loaders: {
      tokenMapLoading: '토큰 맵을 불러오는 중...',
      embeddingSnapshotLoading: '임베딩 스냅샷을 불러오는 중...',
      attentionSnapshotLoading: 'Attention 스냅샷을 불러오는 중...',
      trainingSnapshotLoading: 'Training 스냅샷을 불러오는 중...',
      trainingTraceLoading: 'Training trace를 불러오는 중...',
      inferenceSnapshotLoading: 'Inference 스냅샷을 불러오는 중...',
    },
    errors: {
      tokenMapLoadFailed: '토큰 맵 로드 실패',
      attentionSnapshotLoadFailed: 'Attention/MLP/lm_head 스냅샷 로드 실패',
      embeddingSnapshotLoadFailed: '임베딩 스냅샷 로드 실패',
      trainingTraceLoadFailed: 'Training trace 로드 실패',
      trainingSnapshotLoadFailed: 'Training 스냅샷 로드 실패',
      inferenceSnapshotLoadFailed: 'Inference 스냅샷 로드 실패',
    },
  },
  en: {
    hero: {
      languageSwitchAria: 'Language selection',
      openProjectInfoAria: 'Open project info',
      closeProjectInfoAria: 'Close project info',
      intro: 'Want to see how a Korean name generation GPT reads data and creates new names?',
      startFromData: 'Start From Data',
      goToGithub: 'Go To Github',
      projectInfoTitle: 'PROJECT INFO',
      projectInfoStart: 'This project is based on ',
      projectInfoMiddle: "'s ",
      projectInfoMicrogptLinkText: 'microgpt project',
      projectInfoEnd: ', and visualizes the internal process of a GPT model that generates Korean names.',
      projectInfoGithub: 'Go To this website Github',
    },
    roles: {
      initial: 'Initial',
      medial: 'Medial',
      final: 'Final',
      other: 'Other',
      sequenceStart: 'Sequence Start',
      sequenceEnd: 'Sequence End',
    },
    chapterOne: {
      corePointsLabel: 'Core Points',
      takeawayLabel: 'Takeaway',
    },
    chapterEight: {
      similarityLabel: 'Similarity:',
      differenceLabel: 'Difference:',
    },
    outro: {
      message: 'You have now explored the full process of how microgpt creates Korean names!',
      backToTop: 'Back To Start',
      goToGithub: 'Go To Github',
    },
    footer: {
      next: 'NEXT: Add an interactive quiz section after API integration',
      buildNextModule: 'Build Next Module',
    },
    chapter2: {
      prevExampleNameAria: 'View previous example name',
      nextExampleNameAria: 'View next example name',
      selectedTokenTitle: 'Current Selected Token',
      roleLabel: 'Role',
      syllableLabel: 'Syllable',
      noSelectedTokenMessage: 'No token is selected yet. Click a token to see its details here.',
      tokenChipAria: (display, role, tokenId) => `${display} ${role} token id ${tokenId}`,
    },
    chapter3: {
      samplePhonemeTitle: 'Sample Phoneme',
      prevPhonemeAria: 'Previous phoneme',
      nextPhonemeAria: 'Next phoneme',
      positionIndexTitle: 'Position Index',
      prevPositionIndexAria: 'Previous position index',
      nextPositionIndexAria: 'Next position index',
      conceptAria: (title) => `${title} concept description`,
      tokenEmbeddingInfoBody: 'A vector that captures the intrinsic meaning of the phoneme itself.',
      positionEmbeddingInfoBody:
        'A vector that indicates where a token is located in the sequence. Why embed position information? It helps the model recognize order and refer to previous tokens.',
      sumEmbeddingInfoBody:
        'An intermediate input made by adding token and position embeddings by dimension. This vector reflects both token identity and position.',
      finalEmbeddingInfoBody:
        'The final input after scaling the summed vector with RMSNorm. This normalizes vector magnitude and helps stabilize model training.',
    },
    chapter4: {
      conceptAria: (title) => `${title} concept description`,
      exampleNameTitle: 'Example Name',
      prevExampleNameAria: 'Previous example name',
      nextExampleNameAria: 'Next example name',
      targetIndexTitle: 'Target Index',
      prevTargetIndexAria: 'Previous example index',
      nextTargetIndexAria: 'Next example index',
      replayAria: 'Replay Attention calculation animation',
      skipAria: 'Toggle Chapter 4 animation skip mode',
      finalEmbeddingInfoBody: 'The Final Embedding vector at the current Query position. It is the source used to compute Q, K, and V.',
      qkvInfoBody:
        'Q means Query, K means Key, and V means Value. As an analogy: Q is a question, K is the address of an information shelf, and V is the shelf content itself. The process computes how related Q is to each K, then retrieves V proportionally. Q/K/V are computed from Final Embedding (X).',
      attentionWeightsInfoBody:
        'A probability distribution made by applying softmax to Q·K scores. It represents how strongly each position\'s K is related to Q.',
      attentionOutputInfoBody:
        'The accumulated result of multiplying each position\'s V by its Attention Weight. It summarizes relevant past information for the current position.',
      headOutputsInfoBody:
        'We computed Attention Output for head0 above. In GPT, multiple heads are used to extract information from different perspectives. In this demo, we concatenate 4 head outputs to form the Multi-Head Attention input (x_attn).',
      multiHeadOutputInfoBody: 'We multiply x_attn (16 dimensions) by W_O to obtain the Multi-Head Attention Output.',
      attentionBlockResultInfoBody:
        'A result vector formed by adding Final Embedding (x) and Multi-Head Attention Output. This residual connection improves training stability.',
      transformerBlockOutputInfoBody:
        'The final output vector of the transformer block after applying MLP (rmsnorm → fc1 → relu → fc2 → residual) to the Attention Block Result.',
      logitInfoBody:
        'A linear transform on Transformer Block Output to compute token scores (higher means more likely as the next token). Computed for the full vocab; only top 10 and bottom 2 are shown here.',
      nextTokenProbabilityInfoBody: 'The next-token probability distribution produced by applying softmax to all logits.',
    },
    chapter5: {
      unavailable: 'No displayable data because a training sequence could not be created.',
      exampleNameTitle: 'Example Name',
      prevExampleNameAria: 'View previous example name',
      nextExampleNameAria: 'View next example name',
      targetIndexTitle: 'Target Index',
      prevTargetIndexAria: 'View previous target index',
      nextTargetIndexAria: 'View next target index',
      replayAria: 'Replay Chapter 5 animation',
      skipAria: 'Toggle Chapter 5 animation skip mode',
      nextTokenProbAria: 'Next token probability by POS',
      correctLabel: (label) => `Target: ${label}`,
      tokenLossAria: 'Token loss by POS',
      meanLossAria: 'Mean loss',
      backpropSummaryLabel: 'Abbreviated Description',
      backpropSummaryText:
        'Abbreviated: Internal operations from Block Output to Sum Embedding are also backpropagated with the same chain rule.',
    },
    chapter6: {
      unavailable: 'Unable to display Chapter 6 visualization data.',
      targetStepTitle: 'Select Target Step',
      prevTargetStepAria: 'Select previous target step',
      nextTargetStepAria: 'Select next target step',
      progressStepTitle: 'Progress Step',
      prevStepAria: 'Move one step backward',
      stepSliderAria: (currentStep, targetStep) => `Training step slider. Current ${currentStep}, max ${targetStep}`,
      nextStepAria: 'Move one step forward',
      togglePlayAria: (isPlaying) => (isPlaying ? 'Pause training playback' : 'Resume training playback'),
      startAria: 'Start training',
      resetAria: 'Reset training progress',
      currentWordAria: 'Current training word',
      currentLossAria: 'Current loss',
      lossTrendAria: 'Loss trend by step',
      lossTrendGraphAria: 'Line chart of loss by step',
      lossTrendEmpty: 'No loss data yet.',
      parameterUpdateAria: 'Parameter update formula',
      exampleParameterTitle: 'Example Parameter',
      prevParameterAria: 'Select previous parameter',
      nextParameterAria: 'Select next parameter',
      learningRateHelpAria: 'Open Learning Rate description',
      learningRateHelpText:
        'Learning rate is the step size that determines how strongly gradients update parameters. Large values move faster but can be unstable; small values are stable but slower. In this demo, learning rate decays automatically as steps progress.',
    },
    chapter7: {
      unavailable: 'Unable to display Chapter 7 inference data.',
      queueAria: 'Name queue',
      queuePathAria: (name) => `View generation path for ${name}`,
      queueEmpty: 'Generated names will stack here.',
      generateOneAria: 'Generate 1 name',
      generateOneText: 'Generate 1',
      generateTenAria: 'Generate 10 names',
      generateTenText: 'Generate 10',
      temperatureHelpAria: 'Open Temperature description',
      temperatureHelpText:
        'Lower values choose safer and more repetitive tokens, while higher values choose more diverse tokens. If Temperature is too high, the model may fail to produce proper names.',
      temperatureDownAria: 'Decrease temperature',
      temperatureSliderAria: (temperature, min, max) => `Temperature slider. Current ${temperature}. Min ${min}, max ${max}`,
      temperatureUpAria: 'Increase temperature',
      prevPosAria: 'View previous POS',
      nextPosAria: 'View next POS',
      tokenViewAria: (tokenIndex) => `View token #${tokenIndex}`,
      sampledMeta: (rank, prob) => `rank #${rank} · prob ${prob}`,
    },
    loaders: {
      tokenMapLoading: 'Loading token map...',
      embeddingSnapshotLoading: 'Loading embedding snapshot...',
      attentionSnapshotLoading: 'Loading attention snapshot...',
      trainingSnapshotLoading: 'Loading training snapshot...',
      trainingTraceLoading: 'Loading training trace...',
      inferenceSnapshotLoading: 'Loading inference snapshot...',
    },
    errors: {
      tokenMapLoadFailed: 'Failed to load token map',
      attentionSnapshotLoadFailed: 'Failed to load Attention/MLP/lm_head snapshot',
      embeddingSnapshotLoadFailed: 'Failed to load embedding snapshot',
      trainingTraceLoadFailed: 'Failed to load training trace',
      trainingSnapshotLoadFailed: 'Failed to load training snapshot',
      inferenceSnapshotLoadFailed: 'Failed to load inference snapshot',
    },
  },
}
