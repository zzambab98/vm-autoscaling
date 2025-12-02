# Jenkins Git SCM 설정 가이드

## 개요
Jenkins Job `plg-autoscale-out`을 Git SCM 방식으로 변경하여, Git 저장소에서 자동으로 코드를 가져오도록 설정합니다.

## 설정 방법

### 1. Jenkins 웹 UI 접속
- URL: `http://10.255.0.103:8080`
- 사용자: `danacloud`
- 비밀번호: `!danacloud12`

### 2. Job 설정 페이지로 이동
1. Jenkins 대시보드에서 **`plg-autoscale-out`** Job 클릭
2. 왼쪽 메뉴에서 **"Configure"** 클릭

### 3. Pipeline 설정 변경
1. **"Pipeline"** 섹션으로 스크롤
2. **"Definition"** 드롭다운에서:
   - 현재: `Pipeline script`
   - 변경: **`Pipeline script from SCM`** 선택

### 4. Git 저장소 설정
다음 필드들을 입력:

- **SCM**: `Git` 선택
- **Repositories**:
  - **Repository URL**: `https://github.com/zzambab98/vm-autoscaling.git`
  - **Credentials**: `- none -` (공개 저장소이므로)
- **Branches to build**:
  - **Branch Specifier**: `*/main`
- **Script Path**: `jenkins/Jenkinsfile.autoscale.linux`
- **Lightweight checkout**: ⚠️ **반드시 체크 해제** (전체 프로젝트 필요)
  - 체크되어 있으면 `scripts/` 폴더가 체크아웃되지 않아 F5 스크립트 실행 실패

### 5. 저장
- 페이지 하단의 **"Save"** 버튼 클릭

## 설정 확인

### 빌드 실행 시 확인할 내용
1. 빌드 로그에서 다음 메시지 확인:
   ```
   [Pipeline] checkout
   Cloning the remote Git repository
   Cloning repository https://github.com/zzambab98/vm-autoscaling.git
   ```

2. 워크스페이스에 `scripts/` 폴더가 생성되었는지 확인:
   ```bash
   # Jenkins 서버에서 확인
   ls -la /var/lib/jenkins/workspace/plg-autoscale-out/scripts/
   ```

3. `add-f5-pool-member.py` 파일이 존재하는지 확인:
   ```bash
   ls -la /var/lib/jenkins/workspace/plg-autoscale-out/scripts/add-f5-pool-member.py
   ```

## 장점

✅ **자동 동기화**: Git push만 하면 자동으로 최신 코드 반영
✅ **전체 프로젝트 접근**: `scripts/` 폴더 포함 모든 파일 사용 가능
✅ **버전 관리**: Git으로 코드 버전 관리
✅ **팀 협업**: 여러 개발자가 동시에 작업 가능

## 문제 해결

### 빌드 실패 시
1. **Git 저장소 접근 확인**:
   - Jenkins 서버에서 GitHub 접근 가능한지 확인
   - 방화벽 설정 확인

2. **Script Path 확인**:
   - `jenkins/Jenkinsfile.autoscale.linux` 경로가 정확한지 확인
   - Git 저장소에 해당 파일이 존재하는지 확인

3. **브랜치 확인**:
   - `main` 브랜치가 존재하는지 확인
   - 다른 브랜치를 사용하는 경우 `*/브랜치명`으로 변경

## 참고

- 설정 변경 후 첫 빌드는 Git 체크아웃 시간이 소요될 수 있습니다.
- 이후 빌드는 변경된 파일만 업데이트됩니다 (incremental checkout).

