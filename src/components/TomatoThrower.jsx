import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

const TOMATO_FLIGHT_MS = 2000;
const TOMATO_HOLD_MS = 2000;
const TOMATO_FADE_MS = 500;
const TOMATO_TOTAL_MS = TOMATO_FLIGHT_MS + TOMATO_HOLD_MS + TOMATO_FADE_MS;

function getOffscreenStart(targetX, targetY) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const margin = 90 + Math.random() * 150;
  const side = Math.floor(Math.random() * 4);

  if (side === 0) return { x: -margin, y: Math.max(0, Math.min(height, targetY + (Math.random() - 0.5) * height * 0.7)) };
  if (side === 1) return { x: width + margin, y: Math.max(0, Math.min(height, targetY + (Math.random() - 0.5) * height * 0.7)) };
  if (side === 2) return { x: Math.max(0, Math.min(width, targetX + (Math.random() - 0.5) * width * 0.7)), y: -margin };
  return { x: Math.max(0, Math.min(width, targetX + (Math.random() - 0.5) * width * 0.7)), y: height + margin };
}

export default function TomatoThrower({ enabled = true, reduceMotion = false, targetRef }) {
  const [tomatoes, setTomatoes] = useState([]);
  const [aiming, setAiming] = useState(false);

  useEffect(() => {
    if (!enabled) setAiming(false);
  }, [enabled]);

  useEffect(() => () => {
    // Individual tomato timers are owned by each throw and expire independently.
  }, []);

  function throwTomato(event) {
    if (event.button !== 0 || !targetRef?.current) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = targetRef.current.getBoundingClientRect();
    const targetX = event.clientX;
    const targetY = event.clientY;
    const localX = targetX - rect.left;
    const localY = targetY - rect.top;
    if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return;

    const id = `${Date.now()}-${Math.random()}`;
    const start = getOffscreenStart(targetX, targetY);

    setTomatoes(current => [...current, {
      id,
      targetX,
      targetY,
      startX: start.x,
      startY: start.y,
    }]);

    window.setTimeout(() => {
      setTomatoes(current => current.filter(item => item.id !== id));
    }, TOMATO_TOTAL_MS);
  }

  if (!enabled) return null;

  const overlay = typeof document !== 'undefined' ? createPortal(
    <div className="tomato-screen-zone" aria-hidden="true">
      {tomatoes.map(tomato => (
        <span
          key={tomato.id}
          className={`flying-tomato${reduceMotion ? ' reduced' : ''}`}
          style={{
            '--tomato-x': `${tomato.targetX}px`,
            '--tomato-y': `${tomato.targetY}px`,
            '--tomato-start-x': `${tomato.startX}px`,
            '--tomato-start-y': `${tomato.startY}px`,
            '--tomato-flight': `${TOMATO_FLIGHT_MS}ms`,
            '--tomato-hold': `${TOMATO_HOLD_MS}ms`,
            '--tomato-fade': `${TOMATO_FADE_MS}ms`,
          }}
        >🍅</span>
      ))}
    </div>,
    document.body,
  ) : null;

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

      {overlay}
    </>
  );
}
