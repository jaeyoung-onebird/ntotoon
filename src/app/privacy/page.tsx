import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
      <p className="text-sm text-gray-400 mb-10">엔투툰 (NTOTOON) 개인정보처리방침</p>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        {/* 1. 수집하는 개인정보 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 수집하는 개인정보</h2>
          <p className="mb-2">회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>필수 항목:</strong> 이메일 주소, 비밀번호(암호화하여 저장)</li>
            <li><strong>선택 항목:</strong> 이름(닉네임)</li>
            <li><strong>자동 수집 항목:</strong> 서비스 이용 기록, 접속 로그, 크레딧 사용 내역</li>
          </ul>
        </section>

        {/* 2. 수집 목적 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 개인정보 수집 목적</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li><strong>회원 관리:</strong> 회원 식별, 본인 확인, 계정 관리</li>
            <li><strong>서비스 제공:</strong> AI 웹툰 생성 서비스 제공, 프로젝트 저장 및 관리</li>
            <li><strong>크레딧 관리:</strong> 크레딧 충전, 차감, 내역 관리</li>
            <li><strong>서비스 개선:</strong> 이용 통계 분석, 서비스 품질 향상</li>
          </ul>
        </section>

        {/* 3. 보유 기간 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 개인정보 보유 및 이용 기간</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다.</li>
            <li>단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1 text-sm text-gray-600">
                <li>전자상거래 등에서의 소비자 보호에 관한 법률: 계약 또는 청약 철회에 관한 기록 5년</li>
                <li>대금 결제 및 재화 등의 공급에 관한 기록 5년</li>
                <li>통신비밀보호법: 접속 로그 기록 3개월</li>
              </ul>
            </li>
          </ul>
        </section>

        {/* 4. 제3자 제공 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
          <p className="mb-3">회사는 AI 웹툰 생성을 위해 다음과 같이 제3자에게 데이터를 전송합니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b">제공받는 자</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b">제공 목적</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b">제공 항목</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3">Anthropic (Claude API)</td>
                  <td className="px-4 py-3">텍스트 분석 및 장면 분할을 위한 AI 처리</td>
                  <td className="px-4 py-3">이용자가 입력한 텍스트</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Google (Gemini API)</td>
                  <td className="px-4 py-3">이미지 생성을 위한 AI 처리</td>
                  <td className="px-4 py-3">이용자가 입력한 텍스트</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            상기 제3자는 AI 처리 목적으로만 데이터를 사용하며, 처리 완료 후 데이터를 보관하지 않습니다.
          </p>
        </section>

        {/* 5. 이용자 권리 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">5. 이용자의 권리</h2>
          <p className="mb-2">이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>개인정보 열람 요청</li>
            <li>개인정보 수정 요청</li>
            <li>개인정보 삭제(회원 탈퇴) 요청</li>
            <li>개인정보 처리 정지 요청</li>
          </ul>
          <p className="mt-2 text-sm text-gray-500">
            위 권리 행사는 서비스 내 설정 페이지 또는 이메일을 통해 요청할 수 있습니다.
          </p>
        </section>

        {/* 6. 쿠키 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 쿠키 사용</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>회사는 NextAuth 기반의 세션 쿠키를 사용하여 이용자의 로그인 상태를 유지합니다.</li>
            <li>해당 쿠키는 서비스 이용에 필수적이며, 브라우저 설정을 통해 쿠키를 거부할 수 있으나, 이 경우 서비스 이용이 제한될 수 있습니다.</li>
          </ul>
        </section>

        {/* 7. 보안 조치 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">7. 개인정보 보안 조치</h2>
          <p className="mb-2">회사는 이용자의 개인정보를 안전하게 보호하기 위해 다음과 같은 조치를 취하고 있습니다.</p>
          <ul className="list-disc list-inside space-y-1.5">
            <li>비밀번호는 bcrypt 알고리즘을 사용하여 암호화 저장</li>
            <li>JWT(JSON Web Token) 기반의 안전한 인증 체계 사용</li>
            <li>HTTPS를 통한 데이터 전송 암호화</li>
            <li>데이터베이스 접근 권한 관리 및 보안 설정</li>
          </ul>
        </section>

        {/* 시행일 */}
        <section className="pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            <strong>부칙</strong><br />
            본 개인정보처리방침은 2026년 3월 18일부터 시행합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
