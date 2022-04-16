import React, { ReactNode, useState, useEffect, SetStateAction } from "react";
import { wavetable } from "./wavetable";

enum Track {
  SWEEP = "sweep",
  PULSE = "pulse",
  NOISE = "noise",
  SAMPLE = "sample",
}

const BEATS_PER_BAR = 16;
const audioContext = new AudioContext();
const analyzer = audioContext.createAnalyser();
const wave = audioContext.createPeriodicWave(wavetable.real, wavetable.imag);

interface SweepSequence {
  attack: number;
  release: number;
  steps: boolean[];
}

interface PulseSequence {
  frequency: number;
  lfo: number;
  steps: boolean[];
}

interface NoiseSequence {
  duration: number;
  band: number;
  steps: boolean[];
}

interface SampleSequence {
  rate: number;
  steps: boolean[];
}

function App() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [tempo, setTempo] = useState<number>(120);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedTrack, setSelectedTrack] = useState<Track>(Track.SWEEP);
  const [sweepSequence, setSweepSequence] = useState<SweepSequence>({
    attack: 0.2,
    release: 0.5,
    steps: new Array(BEATS_PER_BAR).fill(false),
  });
  const [pulseSequence, setPulseSequence] = useState<PulseSequence>({
    frequency: 880,
    lfo: 30,
    steps: new Array(BEATS_PER_BAR).fill(false),
  });
  const [noiseSequence, setNoiseSequence] = useState<NoiseSequence>({
    duration: 1,
    band: 1000,
    steps: new Array(BEATS_PER_BAR).fill(false),
  });
  const [sampleSequence, setSampleSequence] = useState<SampleSequence>({
    rate: 1,
    steps: new Array(BEATS_PER_BAR).fill(false),
  });

  const sequenceMap = {
    [Track.SWEEP]: sweepSequence,
    [Track.PULSE]: pulseSequence,
    [Track.NOISE]: noiseSequence,
    [Track.SAMPLE]: sampleSequence,
  };

  function toggleSequenceStep<
    T extends SweepSequence | PulseSequence | NoiseSequence | SampleSequence
  >(i: number): SetStateAction<T> {
    return (prevState: T): T => {
      const { steps, ...params } = prevState;
      const trackSteps = [
        ...steps.slice(0, i),
        !steps[i],
        ...steps.slice(i + 1),
      ];
      return { ...params, steps: trackSteps } as T;
    };
  }

  function handleStepClick(track: Track, i: number): void {
    if (track === Track.SWEEP) {
      setSweepSequence(toggleSequenceStep(i));
      return;
    }

    if (track === Track.PULSE) {
      setPulseSequence(toggleSequenceStep(i));
      return;
    }

    if (track === Track.NOISE) {
      setNoiseSequence(toggleSequenceStep(i));
      return;
    }

    setSampleSequence(toggleSequenceStep(i));
  }

  function playSweep(time: number): void {
    const sweepLength = 2;
    const osc = audioContext.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.value = 380;

    const sweepEnv = audioContext.createGain();
    sweepEnv.gain.cancelScheduledValues(time);
    sweepEnv.gain.setValueAtTime(0, time);
    sweepEnv.gain.linearRampToValueAtTime(1, time + sweepSequence.attack);
    sweepEnv.gain.linearRampToValueAtTime(
      0,
      time + sweepLength - sweepSequence.release
    );

    // pipe selected track signal to analyzer to build spectrum visualizer
    if (selectedTrack === Track.SWEEP) {
      osc.connect(sweepEnv).connect(analyzer).connect(audioContext.destination);
    } else {
      osc.connect(sweepEnv).connect(audioContext.destination);
    }

    osc.start(time);
    osc.stop(time + sweepLength);
  }

  function playPulse(time: number): void {
    const pulseTime = 1;
    const osc = audioContext.createOscillator();
    osc.type = "sine";
    osc.frequency.value = pulseSequence.frequency;

    const amp = audioContext.createGain();
    amp.gain.value = 1;

    const lfo = audioContext.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = pulseSequence.lfo;

    lfo.connect(amp.gain);

    // pipe selected track signal to analyzer to build spectrum visualizer
    if (selectedTrack === Track.PULSE) {
      osc.connect(amp).connect(analyzer).connect(audioContext.destination);
    } else {
      osc.connect(amp).connect(audioContext.destination);
    }

    lfo.start();
    osc.start(time);
    osc.stop(time + pulseTime);
  }

  function playNoise(time: number): void {
    const bufferSize = audioContext.sampleRate * noiseSequence.duration;
    const buffer = audioContext.createBuffer(
      1,
      bufferSize,
      audioContext.sampleRate
    );
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const bandpass = audioContext.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = noiseSequence.band;

    // pipe selected track signal to analyzer to build spectrum visualizer
    if (selectedTrack === Track.NOISE) {
      noise
        .connect(bandpass)
        .connect(analyzer)
        .connect(audioContext.destination);
    } else {
      noise.connect(bandpass).connect(audioContext.destination);
    }
    noise.start(time);
  }

  // TODO: add feature to select a file to sample
  function playSample(
    audioCtx: AudioContext,
    audioBuffer: AudioBuffer,
    time: number
  ): AudioBufferSourceNode {
    const sampleSource = audioCtx.createBufferSource();
    sampleSource.buffer = audioBuffer;
    sampleSource.playbackRate.value = sampleSequence.rate;
    // pipe selected track signal to analyzer to build spectrum visualizer
    if (selectedTrack === Track.SAMPLE) {
      sampleSource.connect(analyzer).connect(audioCtx.destination);
    } else {
      sampleSource.connect(audioCtx.destination);
    }
    sampleSource.start(time);
    return sampleSource;
  }

  function playSound(
    track: Track,
    time: number,
    audioBuffer?: AudioBuffer
  ): void {
    if (track === Track.SWEEP) {
      playSweep(time);
      return;
    }

    if (track === Track.PULSE) {
      playPulse(time);
      return;
    }

    if (track === Track.NOISE) {
      playNoise(time);
      return;
    }

    if (audioBuffer == null) {
      return;
    }

    playSample(audioContext, audioBuffer, time);
  }

  function renderTrackControls(track: Track): ReactNode {
    if (track === Track.SWEEP) {
      return (
        <>
          <label htmlFor="attack">Attack</label>
          <input
            onChange={(e) => {
              setSweepSequence((prevState) => ({
                ...prevState,
                attack: Number(e.target.value),
              }));
            }}
            name="attack"
            id="attack"
            type="range"
            min="0"
            max="1"
            value={sweepSequence.attack}
            step="0.1"
          />
          <label htmlFor="release">Release</label>
          <input
            onChange={(e) => {
              setSweepSequence((prevState) => ({
                ...prevState,
                release: Number(e.target.value),
              }));
            }}
            name="release"
            id="release"
            type="range"
            min="0"
            max="1"
            value={sweepSequence.release}
            step="0.1"
          />
        </>
      );
    }

    if (track === Track.PULSE) {
      return (
        <>
          <label htmlFor="hz">Hertz</label>
          <input
            onChange={(e) => {
              setPulseSequence((prevState) => ({
                ...prevState,
                frequency: Number(e.target.value),
              }));
            }}
            name="hz"
            id="hz"
            type="range"
            min="660"
            max="1320"
            value={pulseSequence.frequency}
            step="1"
          />
          <label htmlFor="lfo">LFO</label>
          <input
            onChange={(e) => {
              setPulseSequence((prevState) => ({
                ...prevState,
                lfo: Number(e.target.value),
              }));
            }}
            name="lfo"
            id="lfo"
            type="range"
            min="20"
            max="40"
            value={pulseSequence.lfo}
            step="1"
          />
        </>
      );
    }

    if (track === Track.NOISE) {
      return (
        <>
          <label htmlFor="duration">Duration</label>
          <input
            onChange={(e) => {
              setNoiseSequence((prevState) => ({
                ...prevState,
                duration: Number(e.target.value),
              }));
            }}
            name="duration"
            id="duration"
            type="range"
            min="0"
            max="2"
            value={noiseSequence.duration}
            step="0.1"
          />
          <label htmlFor="band">Bandpass</label>
          <input
            onChange={(e) => {
              setNoiseSequence((prevState) => ({
                ...prevState,
                band: Number(e.target.value),
              }));
            }}
            name="band"
            id="band"
            type="range"
            min="400"
            max="1200"
            value={noiseSequence.band}
            step="5"
          />
        </>
      );
    }

    return (
      <>
        <label htmlFor="rate">Playback Rate</label>
        <input
          name="rate"
          id="rate"
          type="range"
          min="0.1"
          max="2"
          value={sampleSequence.rate}
          step="0.1"
        />
      </>
    );
  }

  function visualize(): void {
    const canvas = document.querySelector("canvas");
    if (canvas == null) {
      return;
    }

    const canvasCtx = canvas.getContext("2d");
    if (canvasCtx == null) {
      return;
    }

    canvasCtx.fillStyle = "hsla(0, 0%, 10%, 1)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(202, 131, 0)";
    canvasCtx.beginPath();

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzer.getByteTimeDomainData(dataArray);

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
    requestAnimationFrame(visualize);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      requestAnimationFrame(visualize);
      if (!isPlaying) {
        clearInterval(timer);
        return;
      }

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const nextStep = (currentStep + 1) % BEATS_PER_BAR;
      const { currentTime } = audioContext;
      setCurrentStep(nextStep);

      if (sweepSequence.steps[nextStep]) {
        playSound(Track.SWEEP, currentTime);
      }

      if (pulseSequence.steps[nextStep]) {
        playSound(Track.PULSE, currentTime);
      }

      if (noiseSequence.steps[nextStep]) {
        playSound(Track.NOISE, currentTime);
      }

      if (sampleSequence.steps[nextStep]) {
        // TODO: add feature to select a file to sample
        playSound(Track.SAMPLE, currentTime);
      }
      // beats per second converted to milliseconds
    }, (60 / tempo) * 1000);

    return () => {
      clearInterval(timer);
    };
  }, [
    isPlaying,
    currentStep,
    tempo,
    pulseSequence.steps,
    sweepSequence.steps,
    noiseSequence.steps,
    audioContext,
  ]);

  return (
    <div id="sequencer">
      <section className="controls-main">
        <h1>Step Sequencer</h1>
        <label htmlFor="bpm">BPM</label>
        <input
          onChange={(e) => {
            setTempo(Number(e.target.value));
          }}
          name="bpm"
          id="bpm"
          type="range"
          min="60"
          max="240"
          value={tempo}
          step="1"
        />
        <span id="bpmval">{tempo}</span>
        <button
          data-playing={isPlaying}
          onClick={() => {
            setIsPlaying((prevState) => !prevState);
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </section>
      <div id="track">
        {Object.values(Track).map((track) => (
          <button
            aria-selected={track === selectedTrack}
            onClick={() => {
              setSelectedTrack(track);
            }}
          >{`${track.toString().charAt(0).toUpperCase()}${track.slice(
            1
          )}`}</button>
        ))}
      </div>
      <section className="controls">
        {renderTrackControls(selectedTrack)}
      </section>
      <section className="visualization">
        <h4>EQ Visualization</h4>
        <canvas id="eq-visualization"></canvas>
      </section>
      <section className="pads">
        {[...new Array(BEATS_PER_BAR)].map((_, i) => (
          <button
            role="switch"
            aria-checked={sequenceMap[selectedTrack].steps[i]}
            className={isPlaying && currentStep === i ? "triggered" : ""}
            key={`${selectedTrack}-${i}-note`}
            onClick={() => {
              handleStepClick(selectedTrack, i);
            }}
          >
            <span>{`${i + 1} note`}</span>
          </button>
        ))}
      </section>
    </div>
  );
}

export default App;
