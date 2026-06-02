import { useState, useMemo } from 'react';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS   = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

function toStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Build set of all booked date strings (checkIn inclusive, checkOut exclusive)
function buildBookedSet(bookedRanges) {
  const set = new Set();
  bookedRanges.forEach(({ checkIn, checkOut }) => {
    const end = parseLocal(checkOut);
    const cur = parseLocal(checkIn);
    while (cur < end) {
      set.add(toStr(cur));
      cur.setDate(cur.getDate() + 1);
    }
  });
  return set;
}

// Check if any date in (from, to) exclusive endpoints is booked
function rangeHasConflict(fromStr, toStr2, bookedSet) {
  const end = parseLocal(toStr2);
  const cur = parseLocal(fromStr);
  cur.setDate(cur.getDate() + 1);
  while (cur < end) {
    if (bookedSet.has(toStr(cur))) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

export default function DateRangePicker({ bookedRanges = [], from, to, onChange }) {
  const todayDate = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const initDate = from ? parseLocal(from) : todayDate;
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [hover,     setHover]     = useState(null); // string or null
  const [phase,     setPhase]     = useState(from && !to ? 'to' : 'from');

  const bookedSet = useMemo(() => buildBookedSet(bookedRanges), [bookedRanges]);

  const calDays = useMemo(() => {
    const first   = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const pad     = first.getDay(); // 0=Sun
    const days    = Array(pad).fill(null);
    for (let d = 1; d <= lastDay; d++) days.push(new Date(viewYear, viewMonth, d));
    return days;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleClick(date) {
    const ds = toStr(date);
    if (bookedSet.has(ds) || date < todayDate) return;

    if (phase === 'from') {
      onChange(ds, null);
      setPhase('to');
    } else {
      // phase === 'to'
      if (!from || ds <= from) {
        onChange(ds, null);
        setPhase('to');
      } else if (rangeHasConflict(from, ds, bookedSet)) {
        // conflict in range → restart from clicked date
        onChange(ds, null);
        setPhase('to');
      } else {
        onChange(from, ds);
        setPhase('from');
      }
    }
  }

  function getPreviewTo() {
    if (phase === 'to' && hover && from && hover > from) return hover;
    return to;
  }

  function dayClasses(date) {
    if (!date) return '';
    const ds        = toStr(date);
    const isBooked  = bookedSet.has(ds);
    const isPast    = date < todayDate;
    const disabled  = isBooked || isPast;
    const isFrom    = ds === from;
    const previewTo = getPreviewTo();
    const isTo      = ds === (to || previewTo);
    const inRange   = from && previewTo && ds > from && ds < (to || previewTo);
    const isToday   = ds === toStr(todayDate);

    let base = 'relative flex items-center justify-center w-8 h-8 text-xs rounded-full select-none transition-all ';

    if (isFrom || isTo) {
      base += 'bg-blue-600 text-white font-semibold z-10 ';
    } else if (inRange) {
      base += 'bg-blue-100 text-blue-700 rounded-none ';
    } else if (isBooked) {
      base += 'text-red-300 line-through cursor-not-allowed ';
    } else if (isPast) {
      base += 'text-gray-300 cursor-not-allowed ';
    } else {
      base += 'text-gray-700 hover:bg-gray-100 cursor-pointer ';
    }

    if (isToday && !isFrom && !isTo) base += 'ring-1 ring-inset ring-blue-400 ';
    if (disabled) base += 'pointer-events-none ';

    return base;
  }

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition text-base">
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition text-base">
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {calDays.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;
          const ds      = toStr(date);
          const previewTo = getPreviewTo();
          const inRange = from && previewTo && ds > from && ds < (to || previewTo);

          return (
            <div key={ds}
              className={`flex justify-center ${inRange ? 'bg-blue-50' : ''}`}
              onMouseEnter={() => phase === 'to' && setHover(ds)}
              onMouseLeave={() => setHover(null)}>
              <button type="button"
                onClick={() => handleClick(date)}
                className={dayClasses(date)}>
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Legend + hint */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
            Đã chọn
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-200 inline-block" />
            Đã đặt
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {phase === 'from' ? 'Chọn ngày nhận phòng' : 'Chọn ngày trả phòng'}
        </span>
      </div>
    </div>
  );
}
