import { useEffect, useState } from 'react';

interface Props {
    value: number;
    duration?: number;
    formatter?: (val: number) => string;
}

export function CountUp({ value, duration = 1000, formatter }: Props) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);

            // Ease out quart
            const ease = 1 - Math.pow(1 - percentage, 4);

            const current = Math.floor(displayValue + (value - displayValue) * ease);
            setDisplayValue(current);

            if (progress < duration) {
                animationFrameId = window.requestAnimationFrame(animate);
            }
        };

        animationFrameId = window.requestAnimationFrame(animate);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
        // disabling dependency warning for displayValue to avoid restart loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, duration]);

    return <>{formatter ? formatter(displayValue) : displayValue.toLocaleString()}</>;
}
