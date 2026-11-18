import Phaser from 'phaser';
import { BACKGROUND_COLOR, LOGICAL_HEIGHT, LOGICAL_WIDTH, integerZoom } from './config';
import { CaptureScene } from './combat/CaptureScene';
import { CombatScene } from './combat/CombatScene';
import { BattleScene } from './scenes/BattleScene';
import { TitleScene } from './scenes/TitleScene';
import { startProtoBench } from './drawn/ProtoBench';
import { loadFonts } from './ui/font';

// La police pixel doit être prête avant le premier texte (sinon Phaser garde la police
// de secours dans ses textures).
await loadFonts();

// Banc d'essai des combats dessinés (provisoire) : pas de carte, seulement la scène.
if (new URLSearchParams(window.location.search).get('mode') === 'proto') {
  startProtoBench();
} else {
  startGame();
}

function startGame(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    backgroundColor: BACKGROUND_COLOR,
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: integerZoom(window.innerWidth, window.innerHeight),
    },
    // Combat et capture en dernier : ces scènes s'affichent par-dessus la bataille.
    scene: [TitleScene, BattleScene, CombatScene, CaptureScene],
  });

  window.addEventListener('resize', () => {
    game.scale.setZoom(integerZoom(window.innerWidth, window.innerHeight));
  });

  // Développement uniquement : accès au jeu depuis la console et les tests de bout en bout.
  if (import.meta.env.DEV) {
    (window as unknown as { __ANTIQUA_GAME__: Phaser.Game }).__ANTIQUA_GAME__ = game;
  }
}
