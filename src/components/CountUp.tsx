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
        const startValue = displayValue;

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);

            // Ease out quart
            const ease = 1 - Math.pow(1 - percentage, 4);

            const current = Math.floor(startValue + (value - startValue) * ease);
            setDisplayValue(current);

            if (progress < duration) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [value, duration]);

    return <>{formatter ? formatter(displayValue) : displayValue.toLocaleString()}</>;
}
