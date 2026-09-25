import { useEffect, useState } from 'react';

const TOMATO_FLIGHT_MS = 2000;
const TOMATO_HOLD_MS = 2000;
const TOMATO_FADE_MS = 500;
const TOMATO_TOTAL_MS = TOMATO_FLIGHT_MS + TOMATO_HOLD_MS + TOMATO_FADE_MS;

export default function TomatoThrower({ enabled = true, reduceMotion = false, targetRef }) {
  const [tomatoes, setTomatoes] = useState([]);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleMouseDown = event => {
      if (event.button !== 0 || !targetRef?.current) return;
      const rect = targetRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

      const id = `${Date.now()}-${Math.random()}`;

      // Each click creates an independent tomato with its own origin and timer.
      // The origin is deliberately outside the video frame, like a social-media
      // filter effect: tomatoes can fly in from any of the four sides.
      const margin = 90 + Math.random() * 70;
      const side = Math.floor(Math.random() * 4);
      let startX;
      let startY;
      if (side === 0) { // left
        startX = -margin;
        startY = Math.random() * rect.height;
      } else if (side === 1) { // right
        startX = rect.width + margin;
        startY = Math.random() * rect.height;
      } else if (side === 2) { // top
        startX = Math.random() * rect.width;
        startY = -margin;
      } else { // bottom
        startX = Math.random() * rect.width;
        startY = rect.height + margin;
      }

      setTomatoes(current => [...current, {
        id,
        x,
        y,
        startX,
        startY,
      }]);

      window.setTimeout(() => {
        setTomatoes(current => current.filter(item => item.id !== id));
      }, TOMATO_TOTAL_MS);
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [enabled, targetRef]);

  if (!enabled) return null;

  return (
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
  );
}
