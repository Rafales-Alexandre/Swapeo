import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  variant = 'text'
}) => {
  return (
    <div 
      className={`skeleton skeleton-${variant}`}
      style={{ width, height }}
    />
  );
};

export default Skeleton; 