import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '서비스 이용약관',
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">서비스 이용약관</h1>
      <p className="text-sm text-gray-400 mb-10">엔투툰 (NTOTOON) 서비스 이용약관</p>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        {/* 제1조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
          <p>
            본 약관은 엔투툰(이하 &quot;회사&quot;)이 제공하는 AI 웹툰 자동 생성 서비스(이하 &quot;서비스&quot;)의
            이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        {/* 제2조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제2조 (서비스 내용)</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>회사는 이용자가 입력한 텍스트(소설, 시나리오 등)를 AI 기술을 활용하여 웹툰으로 자동 변환하는 서비스를 제공합니다.</li>
            <li>서비스 이용 시 크레딧이 차감되며, 크레딧은 충전 또는 회원가입 시 제공되는 무료 크레딧을 통해 사용할 수 있습니다.</li>
            <li>서비스의 세부 내용, 이용 방법, 크레딧 차감 기준 등은 서비스 내 안내 페이지를 통해 고지합니다.</li>
          </ol>
        </section>

        {/* 제3조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제3조 (회원가입 및 계정)</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>서비스를 이용하기 위해서는 이메일과 비밀번호를 기반으로 회원가입을 해야 합니다.</li>
            <li>이용자는 정확하고 최신의 정보를 제공해야 하며, 타인의 정보를 도용하여 가입할 수 없습니다.</li>
            <li>계정의 관리 책임은 이용자 본인에게 있으며, 계정 정보를 타인에게 양도하거나 공유할 수 없습니다.</li>
          </ol>
        </section>

        {/* 제4조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제4조 (크레딧 및 결제)</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>웹툰 생성 시 사용되는 크레딧은 서비스 내에서 충전할 수 있으며, 생성 요청 시 자동으로 차감됩니다.</li>
            <li>크레딧은 환불이 불가능합니다. 단, 서비스 장애로 인해 크레딧이 차감되었으나 결과물이 정상적으로 제공되지 않은 경우에는 크레딧을 복구해 드립니다.</li>
            <li>회사는 크레딧 가격 및 차감 기준을 변경할 수 있으며, 변경 시 사전에 공지합니다.</li>
          </ol>
        </section>

        {/* 제5조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제5조 (저작권)</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>서비스를 통해 생성된 웹툰의 저작권은 해당 웹툰을 생성한 이용자(작가)에게 귀속됩니다.</li>
            <li>이용자가 입력한 원본 텍스트의 저작권은 원저작자에게 있으며, 이용자는 해당 텍스트의 사용 권한이 있음을 보증합니다.</li>
            <li>AI가 생성한 이미지 및 콘텐츠의 품질, 독창성, 제3자 저작권 침해 여부에 대해 회사는 보증하지 않으며, 이에 대한 책임은 이용자에게 있습니다.</li>
          </ol>
        </section>

        {/* 제6조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제6조 (금지 행위)</h2>
          <p className="mb-2">이용자는 다음 각 호에 해당하는 행위를 하여서는 안 됩니다.</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>불법적이거나 유해한 콘텐츠(아동 학대, 혐오 표현, 폭력 조장 등)를 생성하는 행위</li>
            <li>AI 시스템에 대한 프롬프트 인젝션 또는 기타 보안 우회를 시도하는 행위</li>
            <li>타인의 저작권, 초상권 등 권리를 침해하는 콘텐츠를 생성하는 행위</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>서비스를 이용하여 상업적 스팸 또는 대량 자동 생성을 하는 행위</li>
          </ol>
        </section>

        {/* 제7조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제7조 (서비스 이용 제한)</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>회사는 이용자가 본 약관을 위반한 경우, 사전 통지 없이 서비스 이용을 제한하거나 계정을 정지할 수 있습니다.</li>
            <li>계정 정지 시 잔여 크레딧은 소멸되며, 이에 대한 환불은 불가합니다.</li>
            <li>이용 제한에 대한 이의가 있는 경우, 이용자는 회사에 소명 자료를 제출할 수 있습니다.</li>
          </ol>
        </section>

        {/* 제8조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제8조 (면책조항)</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>AI가 생성한 결과물의 품질, 정확성, 완성도에 대해 회사는 보증하지 않습니다.</li>
            <li>천재지변, 서버 장애, 외부 API 서비스 중단 등 회사의 귀책사유가 아닌 경우에 대해 회사는 책임을 지지 않습니다.</li>
            <li>이용자가 생성한 콘텐츠로 인해 발생하는 법적 분쟁에 대해 회사는 책임을 지지 않습니다.</li>
          </ol>
        </section>

        {/* 제9조 */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">제9조 (개인정보 처리)</h2>
          <p>
            회사는 이용자의 개인정보를 관련 법령에 따라 보호하며, 개인정보의 수집, 이용, 제공 등에 관한 세부 사항은{' '}
            <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">개인정보처리방침</a>에서 확인할 수 있습니다.
          </p>
        </section>

        {/* 시행일 */}
        <section className="pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            <strong>부칙</strong><br />
            본 약관은 2026년 3월 18일부터 시행합니다.
          </p>
        </section>
      </div>
    </div>
  );
}
