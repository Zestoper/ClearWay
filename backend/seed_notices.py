from app.db.database import SessionLocal, create_tables
from app.models.notice import Notice
from app.models.inquiry import FAQ, Inquiry

create_tables()
db = SessionLocal()
try:
    # FAQs
    if db.query(FAQ).count() == 0:
        faqs = [
            FAQ(category="예약", question="예약 후 변경이 가능한가요?", answer="예약 후 출발 24시간 전까지 변경 가능합니다. 변경 수수료가 발생할 수 있습니다.", order_num=1),
            FAQ(category="예약", question="예약 취소 시 환불은 어떻게 되나요?", answer="출발 7일 초과: 100% 환불\n출발 3~7일: 90% 환불\n출발 1~3일: 70% 환불\n출발 1일 이내: 환불 불가", order_num=2),
            FAQ(category="예약", question="비회원도 예약이 가능한가요?", answer="네, 비회원으로도 예약이 가능합니다. 단, 마일리지 적립 및 예약 내역 조회는 회원만 가능합니다.", order_num=3),
            FAQ(category="체크인", question="온라인 체크인은 언제 가능한가요?", answer="출발 48시간 전부터 1시간 전까지 온라인 체크인이 가능합니다.", order_num=1),
            FAQ(category="체크인", question="체크인 후 좌석 변경이 가능한가요?", answer="체크인 완료 후에는 좌석 변경이 불가합니다. 체크인 전에 예약 변경을 통해 좌석을 변경하시기 바랍니다.", order_num=2),
            FAQ(category="수하물", question="무료 수하물 허용량은 얼마인가요?", answer="일반석: 위탁 수하물 23kg × 1개, 기내 수하물 10kg\n비즈니스석: 위탁 수하물 32kg × 2개, 기내 수하물 10kg", order_num=1),
            FAQ(category="수하물", question="초과 수하물 요금은 얼마인가요?", answer="초과 수하물은 구간별로 다르며, 국내선 5,000원/kg, 국제선 15,000원/kg이 적용됩니다.", order_num=2),
            FAQ(category="마일리지", question="마일리지는 어떻게 적립되나요?", answer="일반석: 결제금액의 3~5% 적립\n비즈니스석: 결제금액의 7~10% 적립", order_num=1),
            FAQ(category="마일리지", question="마일리지 등급 기준은 무엇인가요?", answer="BLUE: 기본 등급\nRED: 누적 마일리지 5만 마일 달성\nRAINBOW: 누적 마일리지 20만 마일 달성", order_num=2),
            FAQ(category="마일리지", question="마일리지로 항공권을 구매할 수 있나요?", answer="현재 마일리지 항공권 구매 기능은 준비 중입니다. 빠른 시일 내에 제공될 예정입니다.", order_num=3),
            FAQ(category="결제", question="어떤 결제 방법을 지원하나요?", answer="신용카드/체크카드, 카카오페이, 네이버페이, 토스페이를 지원합니다.", order_num=1),
            FAQ(category="결제", question="결제 영수증 발급이 가능한가요?", answer="결제 완료 후 등록하신 이메일로 영수증이 발송됩니다. 마이페이지에서도 확인 가능합니다.", order_num=2),
        ]
        db.add_all(faqs)
        db.commit()
        print(f"✓ FAQ {len(faqs)}개 삽입")
    else:
        print("FAQ 데이터가 이미 존재합니다. 건너뜁니다.")

    # Notices
    if db.query(Notice).count() == 0:
        notices = [
            Notice(category="promotion", title="얼리버드 특가! 여름 성수기 항공권 최대 40% 할인", content="2026년 여름 성수기(7~8월) 항공권을 지금 예약하시면 최대 40% 할인 혜택을 받으실 수 있습니다.\n\n· 대상 노선: 전 노선\n· 할인율: 최대 40%\n· 예약 기간: 2026.05.04 ~ 2026.05.31\n· 탑승 기간: 2026.07.01 ~ 2026.08.31\n\n선착순 한정 수량이오니 서두르세요!", badge="HOT", is_active=True),
            Notice(category="event", title="가정의 달 특별 이벤트 – 가족 여행 패키지 출시", content="5월 가정의 달을 맞아 가족 여행 패키지를 특별 출시합니다.\n\n· 3인 이상 예약 시 15% 추가 할인\n· 어린이 동반 시 어린이 마일리지 2배 적립\n· 이벤트 기간: 2026.05.01 ~ 2026.05.31", badge="NEW", is_active=True),
            Notice(category="membership", title="RAINBOW 등급 달성 고객 전용 특별 혜택 안내", content="RAINBOW 등급 달성을 진심으로 축하드립니다!\n\n· 공항 라운지 무료 이용 (동반 1인 포함)\n· 비즈니스석 무료 업그레이드 연 2회\n· 마일리지 적립율 1.5배\n· 전용 고객센터 운영\n\n자세한 내용은 고객센터로 문의해 주세요.", badge=None, is_active=True),
            Notice(category="promotion", title="일본 노선 특가 – 도쿄/오사카/후쿠오카", content="인기 일본 노선 특가 항공권을 만나보세요!\n\n· 서울-도쿄(NRT): 69,000원부터\n· 서울-오사카(KIX): 79,000원부터\n· 서울-후쿠오카(FUK): 59,000원부터\n\n· 특가 기간: 2026.05.04 ~ 2026.05.15\n· 탑승 기간: 2026.05.10 ~ 2026.05.30", badge="D-11", is_active=True),
            Notice(category="event", title="SNS 인증샷 이벤트 – 탑승 후기 공유하고 마일리지 받기", content="CLEARWAY 탑승 후기를 SNS에 공유하고 마일리지를 받아가세요!\n\n· 참여 방법: #CLEARWAY #클리어웨이 해시태그 포함 후기 게시\n· 혜택: 500마일 즉시 적립\n· 이벤트 기간: 2026.05.01 ~ 2026.05.31\n· 월 한 번, 1인 1회 참여 가능", badge="NEW", is_active=True),
            Notice(category="notice", title="시스템 점검 안내 – 5월 10일(일) 02:00~04:00", content="더 나은 서비스 제공을 위해 시스템 점검을 실시합니다.\n\n· 점검 일시: 2026년 5월 10일(일) 02:00 ~ 04:00\n· 점검 내용: 서버 안정화 및 보안 업데이트\n· 점검 중 예약, 결제, 체크인 서비스가 일시 중단됩니다.\n\n이용에 불편을 드려 죄송합니다.", badge=None, is_active=True),
        ]
        db.add_all(notices)
        db.commit()
        print(f"✓ Notice {len(notices)}개 삽입")
    else:
        print("Notice 데이터가 이미 존재합니다. 건너뜁니다.")
finally:
    db.close()
