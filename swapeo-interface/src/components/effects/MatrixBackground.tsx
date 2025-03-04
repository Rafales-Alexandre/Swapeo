import React, { useEffect, useRef } from 'react';
import './MatrixBackground.css';

const MatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Matrix characters (you can customize these)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$@#%&*';
    const charSize = 14;
    const columns = canvas.width / charSize;
    const drops: number[] = [];

    // Initialize drops
    for (let i = 0; i < columns; i++) {
      drops[i] = 1;
    }

    const draw = () => {
      // Add semi-transparent black rectangle to create fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Set text color and style
      ctx.fillStyle = '#0F0'; // Matrix green
      ctx.font = `${charSize}px monospace`;

      // Draw characters
      for (let i = 0; i < drops.length; i++) {
        // Random character
        const char = chars[Math.floor(Math.random() * chars.length)];
        
        // Different shades of green for depth effect
        const green = Math.random() > 0.1 ? '#0F0' : '#90EE90';
        ctx.fillStyle = green;

        // Draw the character
        ctx.fillText(char, i * charSize, drops[i] * charSize);

        // Reset position if drop reaches bottom or randomly
        if (drops[i] * charSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }

        // Move drop down
        drops[i]++;
      }
    };

    // Animation loop
    const interval = setInterval(draw, 50);

    // Cleanup
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-background" />;
};

export default MatrixBackground; 