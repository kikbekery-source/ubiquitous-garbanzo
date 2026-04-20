class PriceEngine {
    constructor(startPrice = 2350.00) {
        this.startPrice = startPrice;
        this.currentPrice = startPrice;
        this.candles = [];
        this.tick = 0;
        this.trend = 0;
        this.volatility = 0.5;
        this.momentum = 0;
    }

    reset(startPrice) {
        this.startPrice = startPrice;
        this.currentPrice = startPrice;
        this.candles = [];
        this.tick = 0;
        this.trend = 0;
        this.momentum = 0;
    }

    generateCandle(scenario) {
        const generators = {
            swing: () => this._swingCandle(),
            bull: () => this._trendCandle(1),
            bear: () => this._trendCandle(-1),
            spike_up: () => this._spikeCandle(1, 1000),
            spike_down: () => this._spikeCandle(-1, 1000),
            crash_1000: () => this._flashCrashCandle(-1, 1000),
            pump_1000: () => this._flashCrashCandle(1, 1000),
            choppy: () => this._choppyCandle(),
            custom_spike_up: () => this._spikeCandle(1, 1000),
            custom_spike_down: () => this._spikeCandle(-1, 1000),
        };

        const gen = generators[scenario] || generators.swing;
        const candle = gen();
        this.candles.push(candle);
        this.currentPrice = candle.close;
        this.tick++;
        return candle;
    }

    _swingCandle() {
        const cycleLength = 60 + Math.random() * 40;
        const phase = (this.tick % cycleLength) / cycleLength * Math.PI * 2;
        const swingAmplitude = 15 + Math.random() * 10;

        this.trend = Math.sin(phase) * 0.3;
        const noise = (Math.random() - 0.5) * 2;
        const move = this.trend * swingAmplitude + noise;

        return this._buildCandle(move);
    }

    _trendCandle(direction) {
        const trendStrength = 0.3 + Math.random() * 0.5;
        const noise = (Math.random() - 0.5) * 3;
        const pullback = Math.random() < 0.15 ? -direction * (2 + Math.random() * 3) : 0;
        const move = direction * trendStrength + noise + pullback;

        return this._buildCandle(move);
    }

    _spikeCandle(direction, totalPoints) {
        const totalMove = totalPoints * 0.01;
        const spikeStart = 30;
        const spikePeak = 60;
        const totalCandles = 200;

        if (this.tick < spikeStart) {
            return this._choppyCandle();
        } else if (this.tick < spikePeak) {
            const progress = (this.tick - spikeStart) / (spikePeak - spikeStart);
            const acceleration = Math.pow(progress, 1.5);
            const movePerCandle = (totalMove / (spikePeak - spikeStart)) * (1 + acceleration);
            const noise = (Math.random() - 0.5) * 1;
            return this._buildCandle(direction * movePerCandle + noise);
        } else if (this.tick < totalCandles) {
            const noise = (Math.random() - 0.5) * 2;
            const drift = direction * 0.1 * Math.random();
            return this._buildCandle(drift + noise);
        } else {
            return this._choppyCandle();
        }
    }

    _flashCrashCandle(direction, totalPoints) {
        const totalMove = totalPoints * 0.01;
        const crashStart = 20;
        const crashBottom = 40;
        const recoveryEnd = 120;
        const totalCandles = 200;

        if (this.tick < crashStart) {
            return this._choppyCandle();
        } else if (this.tick < crashBottom) {
            const progress = (this.tick - crashStart) / (crashBottom - crashStart);
            const movePerCandle = (totalMove / (crashBottom - crashStart)) * (1 + progress * 2);
            const noise = (Math.random() - 0.5) * 0.5;
            return this._buildCandle(direction * movePerCandle + noise);
        } else if (this.tick < recoveryEnd) {
            const progress = (this.tick - crashBottom) / (recoveryEnd - crashBottom);
            const recoveryMove = totalMove * 0.8;
            const movePerCandle = (recoveryMove / (recoveryEnd - crashBottom)) * (1 - progress * 0.5);
            const noise = (Math.random() - 0.5) * 1.5;
            return this._buildCandle(-direction * movePerCandle + noise);
        } else {
            return this._swingCandle();
        }
    }

    _choppyCandle() {
        const range = 1.5 + Math.random() * 1.5;
        const move = (Math.random() - 0.5) * range;
        return this._buildCandle(move);
    }

    _buildCandle(move) {
        const open = this.currentPrice;
        const close = open + move;

        const wickUp = Math.random() * Math.abs(move) * 0.8;
        const wickDown = Math.random() * Math.abs(move) * 0.8;

        const high = Math.max(open, close) + wickUp;
        const low = Math.min(open, close) - wickDown;

        const volume = Math.floor(100 + Math.random() * 900 + Math.abs(move) * 200);

        const now = new Date();
        now.setMinutes(now.getMinutes() + this.tick * 5);

        return {
            time: now,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: volume,
            tick: this.tick
        };
    }

    getBid() {
        return parseFloat((this.currentPrice - 0.10).toFixed(2));
    }

    getAsk() {
        return parseFloat((this.currentPrice + 0.10).toFixed(2));
    }

    getSpread() {
        return 20;
    }
}
