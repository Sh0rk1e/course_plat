import { useEffect, useState } from 'react';

const TOMATO_FLIGHT_MS = 2000;
const TOMATO_HOLD_MS = 2000;
const TOMATO_FADE_MS = 500;
const TOMATO_TOTAL_MS = TOMATO_FLIGHT_MS + TOMATO_HOLD_MS + TOMATO_FADE_MS;

export default function TomatoThrower({ enabled = true, reduceMotion = false, targetRef }) {
  const [tomatoes, setTomatoes] = useState([]);
  const [aiming, setAiming] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setAiming(false);
      return undefined;
    }
    return undefined;
  }, [enabled]);

  useEffect(() => () => {
    // React owns the timers through each tomato's expiry callback.
  }, []);

  function throwTomato(event) {
    if (event.button !== 0 || !targetRef?.current) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = targetRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

    const id = `${Date.now()}-${Math.random()}`;
    const margin = 100 + Math.random() * 90;
    const side = Math.floor(Math.random() * 4);
    let startX;
    let startY;
    if (side === 0) {
      startX = -margin;
      startY = Math.random() * rect.height;
    } else if (side === 1) {
      startX = rect.width + margin;
      startY = Math.random() * rect.height;
    } else if (side === 2) {
      startX = Math.random() * rect.width;
      startY = -margin;
    } else {
      startX = Math.random() * rect.width;
      startY = rect.height + margin;
    }

    setTomatoes(current => [...current, { id, x, y, startX, startY }]);
    window.setTimeout(() => {
      setTomatoes(current => current.filter(item => item.id !== id));
    }, TOMATO_TOTAL_MS);
  }

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className={`tomato-toggle${aiming ? ' active' : ''}`}
        onClick={() => setAiming(value => !value)}
        aria-pressed={aiming}
        title={aiming ? 'Tomato mode is on — click the video to throw' : 'Enable tomato throwing'}
      >
        🍅 {aiming ? 'Throwing on' : 'Throw tomatoes'}
      </button>

      {aiming && (
        <div
          className="tomato-capture-zone"
          onMouseDown={throwTomato}
          title="Click to throw a tomato here"
          aria-hidden="true"
        />
      )}

      <div className="tomato-zone" aria-hidden="true">
        {tomatoes.map(tomato => (
          <span
            key={tomato.id}
            className={`flying-tomato${reduceMotion ? ' reduced' : ''}`}
            style={{
              '--tomato-x': `${tomato.x}px`,
              '--tomato-y': `${tomato.y}px`,
              '--tomato-start-x': `${tomato.startX}px`,
              '--tomato-start-y': `${tomato.startY}px`,
              '--tomato-flight': `${TOMATO_FLIGHT_MS}ms`,
              '--tomato-hold': `${TOMATO_HOLD_MS}ms`,
              '--tomato-fade': `${TOMATO_FADE_MS}ms`,
            }}
          >🍅</span>
        ))}
      </div>
    </>
  );
}
