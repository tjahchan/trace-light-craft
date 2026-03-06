import "./AnimatedFlame.css";

interface AnimatedFlameProps {
  active: boolean;
  size?: number;
}

export function AnimatedFlame({ active, size = 36 }: AnimatedFlameProps) {
  if (!active) {
    return (
      <div className="flame-wick" style={{ width: size * 0.3, height: size * 0.5 }}>
        <div className="wick-line" />
      </div>
    );
  }

  return (
    <div className="flame-container" style={{ width: size, height: size }}>
      <div className="flame-glow" />
      <div className="flame-layer flame-core" />
      <div className="flame-layer flame-mid" />
      <div className="flame-layer flame-outer" />
      <div className="flame-layer flame-tip" />
    </div>
  );
}
