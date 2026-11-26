import Phaser from 'phaser';
import { BACKGROUND_COLOR, LOGICAL_HEIGHT, LOGICAL_WIDTH, integerZoom } from './config';
import { CaptureScene } from './combat/CaptureScene';
import { BattleScene } from './scenes/BattleScene';
import { TitleScene } from './scenes/TitleScene';
import { startProtoBench } from './drawn/ProtoBench';
import { loadFonts } from './ui/font';
import { fetchMe } from './compte/api';
import { goToCover, setOnlineStart } from './launch';
import { openOnlineGame } from './online/session';

// Pas de partie sans compte : retour à la page de garde, qui affiche le formulaire.
// Serveur injoignable : même chose, la page de garde le dit.
const me = await fetchMe().catch(() => null);
if (!me) {
  window.location.replace('./');
  await new Promise(() => undefined);
}

// La police pixel doit être prête avant le premier texte (sinon Phaser garde la police
// de secours dans ses textures).
await loadFonts();

// Partie en ligne : on attend l'état officiel du serveur avant de lancer la bataille.
const params = new URLSearchParams(window.location.search);
if (params.get('mode') === 'enligne') {
  try {
    setOnlineStart(await openOnlineGame(params.get('partie') ?? ''));
  } catch (error) {
    window.alert(`Partie en ligne indisponible : ${(error as Error).message}`);
    goToCover();
    await new Promise(() => undefined);
  }
}

// Banc d'essai des combats dessinés (outil de test) : pas de carte, seulement la scène.
// Réservé au développement : absent du menu, et ignoré dans le jeu publié.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('mode') === 'proto') {
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
    scene: [TitleScene, BattleScene, CaptureScene],
  });

  window.addEventListener('resize', () => {
    game.scale.setZoom(integerZoom(window.innerWidth, window.innerHeight));
  });

  // Développement uniquement : accès au jeu depuis la console et les tests de bout en bout.
  if (import.meta.env.DEV) {
    (window as unknown as { __ANTIQUA_GAME__: Phaser.Game }).__ANTIQUA_GAME__ = game;
  }
}
