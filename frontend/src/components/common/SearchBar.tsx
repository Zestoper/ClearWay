import { useState } from 'react';
import './SearchBar.css';
import DatePicker from './DatePicker';
import type { SearchParams } from '../../types';
import { useToast } from './ToastProvider';

const FROM_AIRPORTS = [{ code: 'ICN', city: '서울', name: '인천국제공항' }];

const DOMESTIC = [
    { code: 'GMP', city: '서울', name: '김포국제공항' },
    { code: 'CJU', city: '제주', name: '제주국제공항' },
    { code: 'PUS', city: '부산', name: '김해국제공항' },
    { code: 'TAE', city: '대구', name: '대구국제공항' },
    { code: 'CJJ', city: '청주', name: '청주국제공항' },
    { code: 'KWJ', city: '광주', name: '광주공항' },
    { code: 'RSU', city: '여수', name: '여수공항' },
];

const INTL_REGIONS = [
    {
        region: '아시아',
        airports: [
            { code: 'NRT', city: '도쿄', name: '나리타국제공항', country: '일본' },
            { code: 'HND', city: '도쿄', name: '하네다공항', country: '일본' },
            { code: 'KIX', city: '오사카', name: '간사이국제공항', country: '일본' },
            { code: 'FUK', city: '후쿠오카', name: '후쿠오카공항', country: '일본' },
            { code: 'CTS', city: '삿포로', name: '신치토세공항', country: '일본' },
            { code: 'PEK', city: '베이징', name: '수도국제공항', country: '중국' },
            { code: 'PVG', city: '상하이', name: '푸동국제공항', country: '중국' },
            { code: 'CAN', city: '광저우', name: '바이윈국제공항', country: '중국' },
            { code: 'TPE', city: '타이베이', name: '타오위안국제공항', country: '대만' },
            { code: 'HKG', city: '홍콩', name: '홍콩국제공항', country: '홍콩' },
            { code: 'BKK', city: '방콕', name: '수완나품국제공항', country: '태국' },
            { code: 'DMK', city: '방콕', name: '돈므앙공항', country: '태국' },
            { code: 'SGN', city: '호치민', name: '탄손낫국제공항', country: '베트남' },
            { code: 'HAN', city: '하노이', name: '노이바이국제공항', country: '베트남' },
            { code: 'DAD', city: '다낭', name: '다낭국제공항', country: '베트남' },
            { code: 'MNL', city: '마닐라', name: '니노이아키노국제공항', country: '필리핀' },
            { code: 'CEB', city: '세부', name: '막탄세부국제공항', country: '필리핀' },
            { code: 'SIN', city: '싱가포르', name: '창이국제공항', country: '싱가포르' },
            { code: 'KUL', city: '쿠알라룸푸르', name: 'KLIA', country: '말레이시아' },
        ],
    },
    {
        region: '미주',
        airports: [
            { code: 'JFK', city: '뉴욕', name: '존 F. 케네디국제공항', country: '미국' },
            { code: 'LAX', city: '로스앤젤레스', name: '국제공항', country: '미국' },
            { code: 'SFO', city: '샌프란시스코', name: '국제공항', country: '미국' },
            { code: 'ORD', city: '시카고', name: '오헤어국제공항', country: '미국' },
            { code: 'SEA', city: '시애틀', name: '터코마국제공항', country: '미국' },
            { code: 'YVR', city: '밴쿠버', name: '국제공항', country: '캐나다' },
            { code: 'YYZ', city: '토론토', name: '피어슨국제공항', country: '캐나다' },
        ],
    },
    {
        region: '유럽',
        airports: [
            { code: 'LHR', city: '런던', name: '히드로공항', country: '영국' },
            { code: 'CDG', city: '파리', name: '샤를 드 골 공항', country: '프랑스' },
            { code: 'FRA', city: '프랑크푸르트', name: '국제공항', country: '독일' },
            { code: 'MUC', city: '뮌헨', name: '국제공항', country: '독일' },
            { code: 'FCO', city: '로마', name: '피우미치노공항', country: '이탈리아' },
            { code: 'MXP', city: '밀라노', name: '말펜사공항', country: '이탈리아' },
            { code: 'MAD', city: '마드리드', name: '바라하스공항', country: '스페인' },
            { code: 'BCN', city: '바르셀로나', name: '엘프라트공항', country: '스페인' },
        ],
    },
    {
        region: '오세아니아',
        airports: [
            { code: 'SYD', city: '시드니', name: '킹스포드스미스공항', country: '호주' },
            { code: 'MEL', city: '멜버른', name: '국제공항', country: '호주' },
            { code: 'BNE', city: '브리즈번', name: '국제공항', country: '호주' },
        ],
    },
];

type Airport = { code: string; city: string; name: string; country?: string };

function findAirport(code: string): Airport | null {
    const from = FROM_AIRPORTS.find((a) => a.code === code);
    if (from) return from;
    const dom = DOMESTIC.find((a) => a.code === code);
    if (dom) return dom;
    for (const { airports } of INTL_REGIONS) {
        const found = airports.find((a) => a.code === code);
        if (found) return found;
    }
    return null;
}

const SEAT_CLASSES = [
    { key: 'economy' as const, label: '일반석' },
    { key: 'business' as const, label: '비즈니스석' },
    { key: 'first' as const, label: '일등석' },
];

interface Props {
    onSearch: (params: SearchParams) => void;
    onGoMyTrips?: (ref?: string, lastName?: string) => void;
    onGoCheckin?: (ref?: string, lastName?: string) => void;
    isLoggedIn?: boolean;
}

function todayStr() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function plusDays(base: string, n: number) {
    const d = new Date(base)
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SearchBar({ onSearch, onGoMyTrips, onGoCheckin, isLoggedIn }: Props) {
    const { toast } = useToast()
    const [activeTab, setActiveTab] = useState('booking');
    const [bookingType, setBookingType] = useState('regular');
    const [tripType, setTripType] = useState('roundtrip');
    const [fromCode, setFromCode] = useState('ICN');
    const [toCode, setToCode] = useState('');
    const [date, setDate] = useState(todayStr);
    const [returnDate, setReturnDate] = useState(() => plusDays(todayStr(), 7));
    const [adults, setAdults] = useState(1);
    const [children, setChildren] = useState(0);
    const [infants, setInfants] = useState(0);
    const [seatClass, setSeatClass] = useState<'economy' | 'business' | 'first'>('economy');
    const [showFrom, setShowFrom] = useState(false);
    const [showDestModal, setShowDestModal] = useState(false);
    const [destTab, setDestTab] = useState<'domestic' | 'international'>('international');
    const [showPassengers, setShowPassengers] = useState(false);
    const [showClass, setShowClass] = useState(false);
    const [myTripRef, setMyTripRef] = useState('');
    const [myTripLastName, setMyTripLastName] = useState('');
    const [checkinRef, setCheckinRef] = useState('');
    const [checkinLastName, setCheckinLastName] = useState('');
    const fromAirport = findAirport(fromCode);
    const toAirport = findAirport(toCode);
    const passengerSub = [
        children > 0 ? `소아 ${children}` : '',
        infants > 0 ? `유아 ${infants}` : '',
    ].filter(Boolean).join(' · ')
    const seatClassLabel = SEAT_CLASSES.find((c) => c.key === seatClass)?.label ?? '일반석';

    function closeDropdowns() {
        setShowFrom(false);
        setShowPassengers(false);
        setShowClass(false);
    }

    function swapAirports() {
        setFromCode(toCode || fromCode);
        setToCode(fromCode);
    }

    function handleSearch() {
        if (!toCode || !date) return;
        if (bookingType === 'mileage') {
            toast('마일리지 예매는 현재 준비 중입니다. 일반 예매로 검색합니다.', 'info');
        }
        onSearch({
            from_code: fromCode,
            to_code: toCode,
            date,
            tripType: tripType === 'roundtrip' ? 'roundtrip' : 'oneway',
            returnDate: tripType === 'roundtrip' ? returnDate : undefined,
            passengerCount: adults,
            childrenCount: children,
            infantCount: infants,
        });
    }

    function selectDest(code: string) {
        setToCode(code);
        setShowDestModal(false);
    }

    function clamp(v: number, min: number, max: number) {
        return Math.min(max, Math.max(min, v));
    }

    return (
        <section className="search-section" onClick={closeDropdowns}>
            <div className="search-widget" onClick={(e) => e.stopPropagation()}>
                {/* Tabs */}
                <div className="search-tabs">
                    <button
                        className={`search-tab ${activeTab === 'booking' ? 'active' : ''}`}
                        onClick={() => setActiveTab('booking')}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2C4.3 5.1 3.9 5.4 3.7 5.8l-.3.5c-.2.4-.1.9.3 1.1L8 10 5.9 12.4 4 12l-1 1 2 1 1 2 1-1-.4-1.9L9 11l3.1 4.3c.3.4.8.5 1.2.3l.5-.3c.3-.2.6-.6.5-1.1z" />
                        </svg>
                        항공권 예매
                    </button>
                    <button
                        className={`search-tab ${activeTab === 'mytrip' ? 'active' : ''}`}
                        onClick={() => setActiveTab('mytrip')}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        나의 여행
                    </button>
                    <button
                        className={`search-tab ${activeTab === 'checkin' ? 'active' : ''}`}
                        onClick={() => setActiveTab('checkin')}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="9 11 12 14 22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                        체크인
                    </button>
                </div>

                {/* Body */}
                <div className="search-body">
                    {/* ── 항공권 예매 탭 ── */}
                    {activeTab === 'booking' && (
                        <>
                            <div className="search-suboptions">
                                <div className="booking-type-toggle">
                                    <button
                                        className={bookingType === 'regular' ? 'active' : ''}
                                        onClick={() => setBookingType('regular')}
                                    >
                                        예매
                                    </button>
                                    <button
                                        className={bookingType === 'mileage' ? 'active' : ''}
                                        onClick={() => setBookingType('mileage')}
                                    >
                                        마일리지 예매
                                    </button>
                                </div>
                                <div className="trip-type-options">
                                    <button
                                        className={tripType === 'roundtrip' ? 'active' : ''}
                                        onClick={() => setTripType('roundtrip')}
                                    >
                                        왕복
                                    </button>
                                    <button
                                        className={tripType === 'oneway' ? 'active' : ''}
                                        onClick={() => setTripType('oneway')}
                                    >
                                        편도
                                    </button>
                                </div>
                            </div>

                            <div className="search-fields">
                                {/* Airport selector */}
                                <div className="airport-selector">
                                    {/* From */}
                                    <div
                                        className="airport-field"
                                        onClick={() => {
                                            setShowFrom((v) => !v);
                                            setShowPassengers(false);
                                            setShowClass(false);
                                            setShowDestModal(false);
                                        }}
                                        style={{ cursor: 'pointer', position: 'relative' }}
                                    >
                                        <span className="airport-code">{fromCode}</span>
                                        <span className="airport-name">
                                            {fromAirport ? `${fromAirport.city} · ${fromAirport.name}` : '출발지'}
                                        </span>
                                        {showFrom && (
                                            <div className="airport-dropdown" onClick={(e) => e.stopPropagation()}>
                                                {FROM_AIRPORTS.map((a) => (
                                                    <button
                                                        key={a.code}
                                                        className={`airport-option ${a.code === fromCode ? 'active' : ''}`}
                                                        onClick={() => {
                                                            setFromCode(a.code);
                                                            setShowFrom(false);
                                                        }}
                                                    >
                                                        <strong>{a.code}</strong>
                                                        <span>
                                                            {a.city}
                                                            <em>{a.name}</em>
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button className="swap-btn" onClick={swapAirports} aria-label="출발/도착 교환">
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                                            <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                                        </svg>
                                    </button>

                                    {/* To */}
                                    <div
                                        className="airport-field"
                                        onClick={() => {
                                            setShowDestModal(true);
                                            closeDropdowns();
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <span className={`airport-code ${!toCode ? 'to' : ''}`}>{toCode || 'To'}</span>
                                        <span className="airport-name">
                                            {toAirport
                                                ? `${toAirport.city} · ${toAirport.name}`
                                                : '도착지를 선택하세요'}
                                        </span>
                                    </div>
                                </div>

                                <div className="field-divider" />

                                {/* Date */}
                                <div className="search-field date-field">
                                    <label>출발일</label>
                                    <div className="field-value">
                                        <DatePicker value={date} onChange={(d) => { setDate(d); if (returnDate < d) setReturnDate(d) }} showPrices />
                                    </div>
                                </div>

                                {tripType === 'roundtrip' && (
                                    <>
                                        <div className="field-divider" />
                                        <div className="search-field date-field">
                                            <label>귀국일</label>
                                            <div className="field-value">
                                                <DatePicker value={returnDate} onChange={setReturnDate} minDate={date} showPrices />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="field-divider" />

                                {/* Passengers */}
                                <div
                                    className="search-field passenger-field"
                                    style={{ position: 'relative' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowPassengers((v) => !v);
                                        setShowClass(false);
                                        setShowFrom(false);
                                    }}
                                >
                                    <label>탑승객</label>
                                    <div className="field-value passenger-value">
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                        <div className="passenger-lines">
                                            <span>성인 {adults}명</span>
                                            {passengerSub && <span className="passenger-sub">{passengerSub}</span>}
                                        </div>
                                    </div>

                                    {showPassengers && (
                                        <div
                                            className="field-popup passenger-popup"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {[
                                                {
                                                    label: '성인',
                                                    sub: '만 13세 이상',
                                                    val: adults,
                                                    set: (v: number) => setAdults(clamp(v, 1, 9)),
                                                },
                                                {
                                                    label: '소아',
                                                    sub: '만 2–12세',
                                                    val: children,
                                                    set: (v: number) => setChildren(clamp(v, 0, 9)),
                                                },
                                                {
                                                    label: '유아',
                                                    sub: '만 2세 미만',
                                                    val: infants,
                                                    set: (v: number) => setInfants(clamp(v, 0, adults)),
                                                },
                                            ].map(({ label, sub, val, set }) => (
                                                <div key={label} className="passenger-row">
                                                    <div className="passenger-label">
                                                        <span>{label}</span>
                                                        <em>{sub}</em>
                                                    </div>
                                                    <div className="passenger-counter">
                                                        <button className="counter-btn" onClick={() => set(val - 1)}>
                                                            −
                                                        </button>
                                                        <span className="counter-val">{val}</span>
                                                        <button className="counter-btn" onClick={() => set(val + 1)}>
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                className="popup-confirm-btn"
                                                onClick={() => setShowPassengers(false)}
                                            >
                                                확인
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="field-divider" />

                                {/* Class */}
                                <div
                                    className="search-field class-field"
                                    style={{ position: 'relative' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowClass((v) => !v);
                                        setShowPassengers(false);
                                        setShowFrom(false);
                                    }}
                                >
                                    <label>좌석 등급</label>
                                    <div className="field-value">
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M20.2 7.8l-7.7 7.7-4-4-5.7 5.7" />
                                            <path d="M15 7h6v6" />
                                        </svg>
                                        <span>{seatClassLabel}</span>
                                    </div>

                                    {showClass && (
                                        <div className="field-popup class-popup" onClick={(e) => e.stopPropagation()}>
                                            {SEAT_CLASSES.map(({ key, label }) => (
                                                <button
                                                    key={key}
                                                    className={`class-option ${seatClass === key ? 'active' : ''}`}
                                                    onClick={() => {
                                                        setSeatClass(key);
                                                        setShowClass(false);
                                                    }}
                                                >
                                                    <span className="class-radio" />
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="search-submit"
                                    onClick={handleSearch}
                                    disabled={!toCode || !date}
                                    style={{ opacity: !toCode || !date ? 0.5 : 1 }}
                                >
                                    항공권 검색
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── 나의 여행 탭 ── */}
                    {activeTab === 'mytrip' && (
                        <div className="tab-lookup-body">
                            <div className="tab-lookup-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            {isLoggedIn ? (
                                <>
                                    <p className="tab-lookup-title">내 예약 보기</p>
                                    <p className="tab-lookup-desc">예약한 항공편을 확인하고 관리하세요</p>
                                    <div className="tab-lookup-fields">
                                        <button className="tab-lookup-btn" onClick={() => onGoMyTrips?.()}>
                                            내 예약 보기
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="tab-lookup-title">내 예약 조회</p>
                                    <p className="tab-lookup-desc">예약번호와 성으로 예약 내역을 확인하세요</p>
                                    <div className="tab-lookup-fields">
                                        <input
                                            className="tab-lookup-input"
                                            placeholder="예약번호 (예: CW123456)"
                                            value={myTripRef}
                                            onChange={(e) => setMyTripRef(e.target.value.toUpperCase())}
                                        />
                                        <input
                                            className="tab-lookup-input"
                                            placeholder="성 (영문, 예: KIM)"
                                            value={myTripLastName}
                                            onChange={(e) => setMyTripLastName(e.target.value.toUpperCase())}
                                        />
                                        <button className="tab-lookup-btn" onClick={() => onGoMyTrips?.(myTripRef, myTripLastName)}>
                                            내 예약 조회
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── 체크인 탭 ── */}
                    {activeTab === 'checkin' && (
                        <div className="tab-lookup-body">
                            <div className="tab-lookup-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="9 11 12 14 22 4" />
                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                </svg>
                            </div>
                            <p className="tab-lookup-title">온라인 체크인</p>
                            <p className="tab-lookup-desc">출발 48시간 전부터 1시간 전까지 체크인 가능합니다</p>
                            <div className="tab-lookup-fields">
                                <input
                                    className="tab-lookup-input"
                                    placeholder="예약번호 (예: CW123456)"
                                    value={checkinRef}
                                    onChange={(e) => setCheckinRef(e.target.value.toUpperCase())}
                                />
                                <input
                                    className="tab-lookup-input"
                                    placeholder="성 (영문, 예: KIM)"
                                    value={checkinLastName}
                                    onChange={(e) => setCheckinLastName(e.target.value.toUpperCase())}
                                />
                                <button className="tab-lookup-btn" onClick={() => onGoCheckin?.(checkinRef, checkinLastName)}>
                                    체크인 시작
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Destination Modal */}
            {showDestModal && (
                <div className="dest-modal-overlay" onClick={() => setShowDestModal(false)}>
                    <div className="dest-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="dest-modal-header">
                            <h2 className="dest-modal-title">목적지를 선택하세요</h2>
                            <button className="dest-modal-close" onClick={() => setShowDestModal(false)}>
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="dest-modal-tabs">
                            <button
                                className={`dest-tab-btn ${destTab === 'domestic' ? 'active' : ''}`}
                                onClick={() => setDestTab('domestic')}
                            >
                                국내
                            </button>
                            <button
                                className={`dest-tab-btn ${destTab === 'international' ? 'active' : ''}`}
                                onClick={() => setDestTab('international')}
                            >
                                해외
                            </button>
                        </div>

                        <div className="dest-modal-body">
                            {destTab === 'domestic' ? (
                                <div className="dest-region">
                                    <div className="dest-grid">
                                        {DOMESTIC.map((a) => (
                                            <button
                                                key={a.code}
                                                className={`dest-item ${a.code === toCode ? 'active' : ''}`}
                                                onClick={() => selectDest(a.code)}
                                            >
                                                <span className="dest-item-code">{a.code}</span>
                                                <span className="dest-item-info">
                                                    <span className="dest-item-city">{a.city}</span>
                                                    <span className="dest-item-name">{a.name}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                INTL_REGIONS.map(({ region, airports }) => (
                                    <div key={region} className="dest-region">
                                        <div className="dest-region-title">{region}</div>
                                        <div className="dest-grid">
                                            {airports.map((a) => (
                                                <button
                                                    key={a.code}
                                                    className={`dest-item ${a.code === toCode ? 'active' : ''}`}
                                                    onClick={() => selectDest(a.code)}
                                                >
                                                    <span className="dest-item-code">{a.code}</span>
                                                    <span className="dest-item-info">
                                                        <span className="dest-item-city">{a.city}</span>
                                                        <span className="dest-item-name">
                                                            {a.country} · {a.name}
                                                        </span>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
