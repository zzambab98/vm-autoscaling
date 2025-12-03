# Jenkins 파이프라인: 통합 vs 분리 비교

## 두 가지 접근 방식

### 방식 1: 하나의 파이프라인 (통합)
- `Jenkinsfile.autoscale` 하나로 스케일아웃/스케일인 모두 처리
- `SCALE_ACTION` 파라미터로 분기

### 방식 2: 두 개의 파이프라인 (분리)
- `Jenkinsfile.autoscale-out` (스케일아웃 전용)
- `Jenkinsfile.autoscale-in` (스케일인 전용)

## 상세 비교

### 1. 코드 복잡도

#### 통합 방식
```groovy
pipeline {
    parameters {
        string(name: 'SCALE_ACTION', ...)
    }
    
    stages {
        stage('Scale Out') {
            when { expression { params.SCALE_ACTION == 'scale-out' } }
            steps {
                // VM 생성 로직
                // IP 할당
                // F5 추가
                // Node Exporter 설치
            }
        }
        
        stage('Scale In') {
            when { expression { params.SCALE_ACTION == 'scale-in' } }
            steps {
                // VM 선택
                // F5 제거
                // Node Exporter 삭제
                // VM 삭제
            }
        }
    }
}
```

**문제점:**
- 조건문이 많아져 가독성 저하
- 스케일아웃/스케일인 로직이 섞여 있음
- 실수로 잘못된 단계 실행 가능성

#### 분리 방식
```groovy
// Jenkinsfile.autoscale-out
pipeline {
    stages {
        stage('Create VM') { ... }
        stage('Add to F5') { ... }
        stage('Install Monitoring') { ... }
    }
}

// Jenkinsfile.autoscale-in
pipeline {
    stages {
        stage('Select VM') { ... }
        stage('Remove from F5') { ... }
        stage('Remove Monitoring') { ... }
        stage('Delete VM') { ... }
    }
}
```

**장점:**
- 각 파이프라인이 단순하고 명확
- 로직이 완전히 분리되어 실수 방지
- 가독성 우수

### 2. 유지보수성

#### 통합 방식
- ✅ 하나의 파일만 수정
- ❌ 수정 시 다른 로직에 영향 줄 수 있음
- ❌ 조건문 때문에 버그 찾기 어려움

#### 분리 방식
- ✅ 각각 독립적으로 수정 가능
- ✅ 스케일아웃 수정 시 스케일인에 영향 없음
- ✅ 버그 발생 시 원인 파악 용이

### 3. 안전성

#### 통합 방식
- ❌ `SCALE_ACTION` 파라미터 오류 시 잘못된 액션 실행 가능
- ❌ 조건문 실수로 인한 버그 가능성
- ❌ 스케일인 로직에서 스케일아웃 단계가 실행될 위험

#### 분리 방식
- ✅ 각 파이프라인이 명확한 목적
- ✅ 실수로 잘못된 액션 실행 불가능
- ✅ 각 파이프라인에 필요한 파라미터만 전달

### 4. 코드 중복

#### 통합 방식
- ✅ 공통 로직 재사용 가능
- ✅ 설정 파싱 등 중복 코드 없음

#### 분리 방식
- ⚠️ 공통 로직이 있으면 중복 가능
- ✅ 하지만 공통 로직이 많지 않음:
  - 스케일아웃: VM 생성, F5 추가, 모니터링 설치
  - 스케일인: VM 선택, F5 제거, 모니터링 삭제, VM 삭제
  - **완전히 다른 로직이므로 중복이 적음**

### 5. 디버깅

#### 통합 방식
- ❌ 조건문 때문에 디버깅 복잡
- ❌ 로그에서 스케일아웃/스케일인 구분 필요
- ❌ 실패 지점 파악 어려움

#### 분리 방식
- ✅ 각 파이프라인 로그가 명확
- ✅ 실패 지점 파악 용이
- ✅ 각각 독립적으로 테스트 가능

### 6. Jenkins Job 관리

#### 통합 방식
- ✅ 하나의 Job만 관리
- ✅ 설정이 단순

#### 분리 방식
- ⚠️ 두 개의 Job 관리 필요
- ✅ 하지만 각 Job의 목적이 명확하여 관리 용이
- ✅ 각 Job을 독립적으로 활성화/비활성화 가능

## 실제 코드 예시

### 통합 방식의 문제점

```groovy
stage('Scale Out Steps') {
    when { expression { params.SCALE_ACTION == 'scale-out' } }
    steps {
        stage('Get IP') { ... }
        stage('Create VM') { ... }
        stage('Add to F5') { ... }
    }
}

stage('Scale In Steps') {
    when { expression { params.SCALE_ACTION == 'scale-in' } }
    steps {
        stage('Select VM') { ... }
        stage('Remove from F5') { ... }
        stage('Delete VM') { ... }
    }
}
```

**문제:**
- 파이프라인이 길어짐 (300+ 줄)
- 조건문이 많아 가독성 저하
- 실수로 잘못된 단계 실행 가능

### 분리 방식의 장점

```groovy
// Jenkinsfile.autoscale-out (150줄)
pipeline {
    stages {
        stage('Get IP') { ... }
        stage('Create VM') { ... }
        stage('Add to F5') { ... }
        stage('Install Monitoring') { ... }
    }
}

// Jenkinsfile.autoscale-in (150줄)
pipeline {
    stages {
        stage('Select VM') { ... }
        stage('Remove from F5') { ... }
        stage('Remove Monitoring') { ... }
        stage('Delete VM') { ... }
    }
}
```

**장점:**
- 각 파이프라인이 짧고 명확
- 로직이 완전히 분리
- 실수 방지

## 공통 로직 처리 방법

### 공통 로직이 있다면?

**방법 1: Shared Library 사용**
```groovy
// vars/autoscaling.groovy
def getConfig(configId) {
    // 공통 설정 조회 로직
}

// Jenkinsfile.autoscale-out
@Library('shared-lib') _
pipeline {
    stages {
        script {
            def config = autoscaling.getConfig(params.CONFIG_ID)
        }
    }
}
```

**방법 2: 별도 스크립트 파일**
```groovy
// scripts/common.sh
get_config() {
    # 공통 로직
}

// Jenkinsfile.autoscale-out
sh 'scripts/common.sh get_config'
```

**방법 3: 간단한 중복 허용**
- 공통 로직이 많지 않다면 중복 허용
- 각 파이프라인이 독립적으로 동작하는 것이 더 중요

## 결론 및 권장사항

### ✅ **분리 방식 권장**

**이유:**
1. **안전성**: 실수로 잘못된 액션 실행 불가능
2. **가독성**: 각 파이프라인이 단순하고 명확
3. **유지보수**: 독립적으로 수정 가능
4. **디버깅**: 문제 파악이 쉬움
5. **확장성**: 나중에 각각 다른 로직 추가 용이

**단점:**
- 두 개의 Job 관리 필요 (하지만 관리가 더 쉬움)
- 약간의 코드 중복 (하지만 공통 로직이 많지 않음)

### 통합 방식을 선택해야 하는 경우

- 공통 로직이 매우 많고 복잡한 경우
- 파이프라인 설정이 매우 단순한 경우
- 하나의 Job으로 통합 관리가 반드시 필요한 경우

## 구현 시 주의사항

### 분리 방식으로 구현할 때

1. **파일명 명확히 구분**
   - `Jenkinsfile.autoscale-out`
   - `Jenkinsfile.autoscale-in`

2. **Jenkins Job 이름 구분**
   - `autoscale-{serviceName}-out`
   - `autoscale-{serviceName}-in`

3. **Alertmanager 라우팅**
   - 스케일아웃 Alert → `autoscale-out` Job
   - 스케일인 Alert → `autoscale-in` Job

4. **공통 로직 처리**
   - Shared Library 또는 별도 스크립트 사용
   - 또는 간단한 중복 허용

## 최종 권장사항

**두 개의 파이프라인으로 분리하는 것을 강력히 권장합니다.**

이유:
- 스케일아웃과 스케일인은 **완전히 다른 로직**
- 안전성이 최우선 (VM 삭제는 위험한 작업)
- 각 파이프라인이 단순하고 명확
- 유지보수가 훨씬 쉬움

