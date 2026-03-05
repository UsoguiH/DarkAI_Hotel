import {
	useEffect,
	Suspense,
	useMemo,
	useRef,
	useState,
	useCallback,
} from 'react';
import { KeyboardControls } from '@react-three/drei';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import Interface from './components/Interface/Interface';
import './style.css';
import useGame from './hooks/useGame';
import useInterface from './hooks/useInterface';
import useDoor from './hooks/useDoor';
import useMonster from './hooks/useMonster';
import useGridStore from './hooks/useGrid';
import useLight from './hooks/useLight';
import PostProcessing from './components/PostProcessing';

import { Leva, useControls, button } from 'leva';

import CustomPointerLockControls from './components/CustomPointerLockControls';
import UnsupportedGPU from './components/Interface/UnsupportedGPU';
import IntegratedGPUWarning from './components/Interface/IntegratedGPUWarning';
import { checkGPUSupport } from './utils/gpuDetection';

// Models
import Reception from './components/Reception/Reception';
// Tutorial
import Tutorial from './components/Tutorial/Tutorial';
// Game
import Player from './components/Player/Player';

import ReceptionDoors from './components/Reception/ReceptionDoors';
import Sound from './components/Sound';
import { regenerateData } from './utils/config';
import ListeningMode from './components/Player/ListeningMode';
import { preloadSounds, setMasterVolume } from './utils/audio';
import useSettings from './hooks/useSettings';
import ShadowManager from './components/ShadowManager';
import { isPointerLocked, exitPointerLock } from './utils/pointerLock';
import { isElectron } from './utils/platform';
import DarkTherapist from './components/DarkTherapist/DarkTherapist';
import usePhone from './hooks/usePhone';

function resetGame() {
	useGame.getState().restart();
	useInterface.getState().restart();
	useDoor.getState().restart();
	useMonster.getState().restart();
	useGame.getState().setPlayIntro(true);
	useLight.getState().restart();
}

function App() {
	const isMobile = useGame((state) => state.isMobile);
	const deviceMode = useGame((state) => state.deviceMode);
	const setIsLocked = useGame((state) => state.setIsLocked);
	const disableControls = useGame((state) => state.disableControls);
	const controlsRef = useRef();
	const [isStable, setIsStable] = useState(false);
	const frameCount = useRef(0);
	const lastTime = useRef(performance.now());
	const introIsPlaying = useGame((state) => state.introIsPlaying);
	const hasIntroBeenPlayedRef = useRef(false);
	const masterVolume = useSettings((state) => state.masterVolume);
	const isDarkTherapistOpen = usePhone((state) => state.isOpen);

	useEffect(() => {
		setMasterVolume(masterVolume);
	}, []);

	useEffect(() => {
		setMasterVolume(masterVolume);
	}, [masterVolume]);

	useEffect(() => {
		const audioContext = new (window.AudioContext ||
			window.webkitAudioContext)();

		const initAudio = async () => {
			try {
				if (audioContext.state === 'suspended') {
					await audioContext.resume();
				}
				await preloadSounds();
			} catch (error) {
				console.error('Error loading sounds:', error);
			}
		};

		const handleFirstInteraction = () => {
			initAudio();
			document.removeEventListener('click', handleFirstInteraction);
		};

		document.addEventListener('click', handleFirstInteraction);
		return () => {
			document.removeEventListener('click', handleFirstInteraction);
			audioContext.close();
		};
	}, []);

	useEffect(() => {
		const controls = controlsRef.current;

		const handleLock = () => setIsLocked(true);
		const handleUnlock = () => {
			if (deviceMode === 'keyboard') {
				setIsLocked(false);
			}
		};

		if (controls) {
			controls.addEventListener('lock', handleLock);
			controls.addEventListener('unlock', handleUnlock);

			return () => {
				controls.removeEventListener('lock', handleLock);
				controls.removeEventListener('unlock', handleUnlock);
			};
		}
	}, [setIsLocked, deviceMode]);

	useEffect(() => {
		if (
			deviceMode === 'keyboard' &&
			controlsRef.current &&
			!disableControls &&
			!isDarkTherapistOpen &&
			!useGame.getState().isEndScreen
		) {
			controlsRef.current.lock();
		}
	}, [deviceMode, disableControls, isDarkTherapistOpen]);

	// Unlock pointer when Dark Therapist overlay opens
	useEffect(() => {
		if (isDarkTherapistOpen && controlsRef.current) {
			controlsRef.current.unlock();
		}
	}, [isDarkTherapistOpen]);

	useEffect(() => {
		if (introIsPlaying) {
			hasIntroBeenPlayedRef.current = true;
		}
	}, [introIsPlaying]);

	useEffect(() => {
		if (!introIsPlaying && !hasIntroBeenPlayedRef.current) {
			const { camera } = useThree.getState ? {} : {};
		}
	}, [introIsPlaying]);

	useEffect(() => {
		const initialTimer = setTimeout(
			() => {
				frameCount.current = 0;
				lastTime.current = performance.now();
			},
			isMobile ? 5000 : 2000
		);

		return () => clearTimeout(initialTimer);
	}, [isMobile]);

	useFrame(({ camera }) => {
		if (!lastTime.current) return;

		const currentTime = performance.now();
		const deltaTime = currentTime - lastTime.current;

		const targetDelta = isMobile ? 50 : 33;
		const requiredFrames = isMobile ? 30 : 60;

		if (deltaTime < targetDelta) {
			frameCount.current++;
		} else {
			frameCount.current = Math.max(0, frameCount.current - 2);
		}

		if (frameCount.current > requiredFrames && !isStable) {
			setIsStable(true);
		}

		lastTime.current = currentTime;
	});

	const shouldRenderThreeJs = useGame((state) => state.shouldRenderThreeJs);

	return (
		<>
			<ListeningMode />
			<KeyboardControls
				map={[
					{ name: 'forward', keys: ['ArrowUp', 'KeyW', 'KeyZ', 'gamepad1'] },
					{ name: 'backward', keys: ['ArrowDown', 'KeyS', 'gamepad2'] },
					{ name: 'left', keys: ['ArrowLeft', 'KeyA', 'KeyQ', 'gamepad3'] },
					{ name: 'right', keys: ['ArrowRight', 'KeyD', 'gamepad4'] },
					{ name: 'jump', keys: ['Space', 'gamepad0'] },
					{ name: 'run', keys: ['ShiftLeft', 'ShiftRight', 'gamepad10'] },
					{
						name: 'crouch',
						keys: ['ControlLeft', 'ControlRight', 'MetaLeft', 'gamepad11'],
					},
					{ name: 'action', keys: ['KeyE', 'gamepad5'] },
				]}
			>
				{deviceMode !== 'gamepad' && !isMobile && !disableControls && !isDarkTherapistOpen && (
					<CustomPointerLockControls ref={controlsRef} />
				)}

				<Player />
				<Sound />
				<Tutorial />

				{shouldRenderThreeJs && (
					<>
						<ReceptionDoors />
						<Reception />
					</>
				)}
			</KeyboardControls>
		</>
	);
}

export default function AppCanvas() {
	const performanceMode = useGame((state) => state.performanceMode);
	const isMobile = useGame((state) => state.isMobile);
	const setPlayIntro = useGame((state) => state.setPlayIntro);
	const shadows = useSettings((state) => state.shadows);
	const setShadows = useSettings((state) => state.setShadows);

	const gpuCheck = useMemo(() => checkGPUSupport(), []);
	const [integratedGPUInfo, setIntegratedGPUInfo] = useState(null);
	const [showGPUWarning, setShowGPUWarning] = useState(false);

	useEffect(() => {
		// Listen for GPU detection from Electron
		if (typeof window.gpuAPI !== 'undefined') {
			window.gpuAPI.onGPUDetected((gpuInfo) => {
				console.log('GPU Info received from Electron:', gpuInfo);
				if (gpuInfo.isIntelIntegrated) {
					setIntegratedGPUInfo(gpuInfo);
					setShowGPUWarning(true);
				}
			});

			return () => {
				window.gpuAPI.removeGPUListener();
			};
		}
	}, []);

	useEffect(() => {
		if (isElectron()) {
			setShadows(true);
		} else {
			setShadows(performanceMode && !isMobile);
		}
	}, [performanceMode, isMobile, setShadows]);

	useControls(
		{
			'Reset game': button(() => {
				regenerateData();
				resetGame();
			}),
			'Play Intro Animation': button(() => {
				setPlayIntro(true);
			}),
		},
		{
			collapsed: true,
		}
	);

	const isDebugMode = window.location.hash.includes('#debug');

	const forceGPUError = window.location.hash.includes('#test-gpu-error');
	if (forceGPUError) {
		return (
			<UnsupportedGPU
				reason="tooOld"
				gpuInfo="Intel(R) HD Graphics 3000 (Test Mode)"
			/>
		);
	}

	if (!gpuCheck.isSupported) {
		return (
			<UnsupportedGPU reason={gpuCheck.reason} gpuInfo={gpuCheck.gpuInfo} />
		);
	}

	return (
		<>
			{showGPUWarning && integratedGPUInfo && (
				<IntegratedGPUWarning
					gpuInfo={integratedGPUInfo}
					onDismiss={() => setShowGPUWarning(false)}
				/>
			)}
			<div onClick={(e) => e.stopPropagation()}>
				<Leva collapsed hidden={!isDebugMode} />
			</div>
			<Suspense fallback={null}>
				<Canvas
					camera={{
						fov: 75,
						near: 0.1,
						far: 30,
					}}
					gl={{
						powerPreference: 'high-performance',
						antialias: false,
						depth: true,
						stencil: false,
					}}
					dpr={1}
					performance={{ min: 0.5 }}
					shadows={shadows}
				>
					<ShadowManager />
					<App />
					<PostProcessing />
				</Canvas>
			</Suspense>
			<Interface />
			<DarkTherapist />
		</>
	);
}
