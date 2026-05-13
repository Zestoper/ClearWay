import './Skeleton.css'

export function Skeleton({ w = '100%', h = '16px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r }} />
}

export function FlightSkeleton() {
  return (
    <div className="sk-flights">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="sk-flight-card">
          <div className="sk-flight-top">
            <div className="sk-col">
              <Skeleton w="56px" h="11px" />
              <Skeleton w="88px" h="24px" r="4px" />
            </div>
            <div className="sk-col sk-col--center">
              <Skeleton w="40px" h="11px" />
              <Skeleton w="72px" h="11px" />
            </div>
            <div className="sk-col">
              <Skeleton w="56px" h="11px" />
              <Skeleton w="88px" h="24px" r="4px" />
            </div>
            <div className="sk-col sk-col--right">
              <Skeleton w="88px" h="22px" r="4px" />
              <Skeleton w="76px" h="36px" r="10px" />
            </div>
          </div>
          <div className="sk-flight-foot">
            <Skeleton w="80px" h="11px" />
            <Skeleton w="60px" h="11px" />
          </div>
        </div>
      ))}
    </div>
  )
}
