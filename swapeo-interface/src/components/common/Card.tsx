import React, { useState } from 'react';
import './Card.css';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  type?: 'default' | 'success' | 'warning' | 'error';
  loading?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  icon,
  className = '',
  type = 'default',
  loading = false,
  onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`card ${type} ${loading ? 'loading' : ''} ${className}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {(title || icon) && (
        <div className="card-header">
          {icon && (
            <div className={`card-icon ${isHovered ? 'hovered' : ''}`}>
              {icon}
            </div>
          )}
          <div className="card-titles">
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="card-content">
        {loading ? (
          <div className="card-loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default Card; 