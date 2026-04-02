import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing
} from 'react-native-reanimated';

import { CHARACTERS, WORLDS } from '../data';
import { GameState } from '../types/types';

interface HomeViewProps {
  gameState: GameState;
  onSelectWorld: (worldId: string, levelIndex?: number) => void;
  onOpenAlbum: () => void;
  onOpenGallery: () => void;
  onOpenWorldMap: () => void;
  onChangeCharacter: () => void;
  onLanguageChange: (language: 'EN' | 'HE') => void;
  animateUnlock?: boolean;
  onAnimationComplete?: () => void;
}

const { width, height } = Dimensions.get('window');

const uiText = {
  en: {
    gameMap: 'Brsh Guess It !',
    currentLevel: 'CURRENT',
    completedLevel: 'COMPLETED',
    lockedLevel: 'LOCKED',
    levelLabel: 'Level',
    ready: 'Ready to play!',
    play: 'PLAY',
    toggle: 'עב',
    album: 'My Album',
    mapMenu: 'Map',
    characterMenu: 'My Character',
  },
  he: {
    gameMap: 'ברש נחש מי !',
    currentLevel: 'נוכחי',
    completedLevel: 'הושלם',
    lockedLevel: 'נעול',
    levelLabel: 'שלב',
    ready: 'מוכן לשחק!',
    play: 'שחק',
    toggle: 'ENG',
    album: 'האלבום שלי',
    mapMenu: 'מפה',
    characterMenu: 'הדמות שלי',
  },
};

const generateLevelPositions = (levelCount: number) => {
  const positions = [];
  // Calculate spacing so that levels fit well. The map is scrollable.
  const spacing = 180; // Distance between levels in pixels
  
  for (let i = 0; i < levelCount; i++) {
    // 0 = right, 1 = left, 2 = right...
    const isLeft = i % 2 === 1;
    positions.push({
      x: isLeft ? 30 : 70, // percentage of width
      // Start from bottom, move up
      y: (levelCount - i - 1) * spacing + 100, // absolute pixels from top
    });
  }
  
  return positions;
};

const createPathData = (mapConfig: any[]) => {
  if (mapConfig.length === 0) return '';
  const pathPoints = mapConfig.map((config) => ({
    x: (config.x / 100) * width,
    y: config.y,
  }));

  // We want to draw path from bottom (level 0) to top (level N-1)
  // So we reverse the pathPoints for drawing
  const points = [...pathPoints].reverse();

  let pathData = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathData += ` L ${points[i].x} ${points[i].y}`;
  }
  return pathData;
};

const createPathElements = (mapConfig: any[]) => {
  if (mapConfig.length === 0) return [];
  const points = mapConfig.map((config) => ({
    x: config.x, // keep as percentage for now, or convert?
    y: config.y,
  })).reverse();

  const elements = [];
  const itemsPerSegment = 3; // Number of elements between each level

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    for (let j = 1; j <= itemsPerSegment; j++) {
      const fraction = j / (itemsPerSegment + 1);
      const ex = p1.x + (p2.x - p1.x) * fraction;
      const ey = p1.y + (p2.y - p1.y) * fraction;
      elements.push({ id: `path_${i}_${j}`, x: ex, y: ey });
    }
  }
  return elements;
};

const CharacterVideo = ({ source, style }: { source: any; style: any }) => {
  const player = useVideoPlayer(source, player => {
    player.loop = true;
    player.play();
  });

  return (
    <View style={style}>
      <VideoView 
        player={player} 
        style={StyleSheet.absoluteFillObject} 
        nativeControls={false} 
        contentFit="contain" 
      />
    </View>
  );
};

const LevelNode = ({ level, playerChar, pulseScale, characterGlowOpacity, onPress, onPlay, t }: any) => {
  const isCurrent = level.isCurrent;

  const animatedNodeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isCurrent ? pulseScale.value : 1 }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: isCurrent ? characterGlowOpacity.value : 0,
  }));

  return (
    <View
      style={[
        styles.levelNodeContainer,
        { left: `${level.x}%`, top: level.y }
      ]}
    >
      <Animated.View style={[styles.nodeWrapper, animatedNodeStyle]}>
        {!level.unlocked && (
          <View style={styles.lockedIconGlow}>
            <Text style={styles.lockEmoji}>🔒</Text>
          </View>
        )}

        {level.completed && level.fullImage && (
          <View style={styles.completedImageContainer}>
            <Image
              source={typeof level.fullImage === 'string' ? { uri: level.fullImage } : level.fullImage}
              style={styles.completedElementImage}
              contentFit="cover"
            />
          </View>
        )}

        <TouchableOpacity
          activeOpacity={level.unlocked ? 0.8 : 1}
          onPress={() => level.unlocked && onPress()}
          style={styles.nodeTouchable}
        >
          <Image
            source={require('../../assets/island-platform_nobg.png')}
            style={[
              styles.islandImage,
              !level.unlocked && styles.islandImageDimmed,
              isCurrent && styles.islandImageLarge
            ]}
            contentFit="contain"
          />

          {isCurrent && (playerChar?.image || playerChar?.video) && (
            <View style={styles.characterContainer}>
              <Animated.View style={[styles.characterGlow, animatedGlowStyle]} />
              {playerChar.video ? (
                <CharacterVideo source={playerChar.video} style={styles.characterOnIsland} />
              ) : (
                <Image
                  source={typeof playerChar.image === 'string' ? { uri: playerChar.image } : playerChar.image}
                  style={styles.characterOnIsland}
                  contentFit="contain"
                />
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={onPlay}
            activeOpacity={0.8}
            style={[
              styles.levelButton,
              level.completed ? styles.levelButtonCompleted : (isCurrent ? styles.levelButtonCurrent : styles.levelButtonLocked)
            ]}
          >
            <Text style={[
              styles.levelButtonText,
              !level.unlocked && styles.levelButtonTextLocked
            ]}>
              {t.levelLabel} {level.id}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const HomeView: React.FC<HomeViewProps> = ({
  gameState,
  onSelectWorld,
  onOpenAlbum,
  onOpenWorldMap,
  onChangeCharacter,
  onLanguageChange
}) => {
  const language = gameState.language.toLowerCase() as 'en' | 'he';
  const isHebrew = language === 'he';
  const t = uiText[language];

  const initialWorldIndex = gameState.currentWorldId
    ? WORLDS.findIndex(w => w.id === gameState.currentWorldId)
    : 0;
  const [activeWorldIndex, setActiveWorldIndex] = useState(Math.max(0, initialWorldIndex));
  const [showWorldList, setShowWorldList] = useState(false);

  useEffect(() => {
    if (gameState.currentWorldId) {
      const worldIndex = WORLDS.findIndex(w => w.id === gameState.currentWorldId);
      if (worldIndex !== -1 && worldIndex !== activeWorldIndex) {
        setActiveWorldIndex(worldIndex);
      }
    }
  }, [gameState.currentWorldId]);

  const activeWorld = WORLDS[activeWorldIndex] || WORLDS[0];

  const sortedWorldsList = useMemo(() => {
    return WORLDS.map((world, index) => ({ world, originalIndex: index }))
      .sort((a, b) => {
        const nameA = isHebrew ? a.world.name.he : a.world.name.en;
        const nameB = isHebrew ? b.world.name.he : b.world.name.en;
        return nameA.localeCompare(nameB, isHebrew ? 'he' : 'en');
      });
  }, [isHebrew]);

  const selectWorldFromList = (originalIndex: number) => {
    setActiveWorldIndex(originalIndex);
    setShowWorldList(false);
  };

  const goToPrevWorld = () => {
    setActiveWorldIndex(prev => (prev > 0 ? prev - 1 : WORLDS.length - 1));
  };

  const goToNextWorld = () => {
    setActiveWorldIndex(prev => (prev < WORLDS.length - 1 ? prev + 1 : 0));
  };

  const mapConfig = useMemo(() => {
    return generateLevelPositions(activeWorld.levels.length);
  }, [activeWorld.levels.length]);

  const mapHeight = useMemo(() => {
    return Math.max(height * 0.8, activeWorld.levels.length * 180 + 200);
  }, [activeWorld.levels.length]);

  const levels = useMemo(() => {
    let currentLevelIndex = -1;
    
    return activeWorld.levels.map((level: any, index: number) => {
      const completed = gameState.completedLevels.includes(level.id);
      const isFirst = index === 0;
      const prevCompleted = index > 0 && gameState.completedLevels.includes(activeWorld.levels[index - 1].id);
      const unlocked = isFirst || prevCompleted;
      
      const isCurrent = unlocked && !completed && currentLevelIndex === -1;
      if (isCurrent) {
        currentLevelIndex = index;
      }
      
      return {
        id: index + 1,
        realId: level.id,
        unlocked,
        completed,
        isCurrent,
        fullImage: level.fullImage,
        ...mapConfig[index]
      };
    });
  }, [activeWorld, gameState.completedLevels, mapConfig]);

  const currentLevelIdx = useMemo(() => {
    const idx = levels.findIndex((l: any) => l.isCurrent);
    return idx === -1 ? 0 : idx;
  }, [levels]);

  const currentLevel = levels[currentLevelIdx] || levels[0];

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'HE' : 'EN';
    onLanguageChange(newLang);
  };

  const pathElements = useMemo(() => createPathElements(mapConfig), [mapConfig]);

  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const pulseScale = useSharedValue(1);
  const characterGlowOpacity = useSharedValue(0.5);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    
    // אנימציית פעימה איטית ועדינה להילה של הדמות
    characterGlowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const handlePlayPress = () => {
    if (currentLevel && currentLevel.unlocked && !currentLevel.completed) {
      buttonScale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      setTimeout(() => onSelectWorld(activeWorld.id, currentLevelIdx), 200);
    }
  };

  const playerChar = CHARACTERS.find(c => c.id === gameState.characterId);
  const scrollViewRef = React.useRef<ScrollView>(null);

  // Scroll to current level on mount or world change
  useEffect(() => {
    if (currentLevel && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, currentLevel.y - height / 2 + 100),
          animated: true
        });
      }, 300);
    }
  }, [currentLevel, activeWorldIndex]);

  return (
    <View style={styles.container}>
      {/* Background Image - world specific */}
      <Image
        source={activeWorld.background || require('../../assets/background.png')}
        style={styles.backgroundImage}
        contentFit="cover"
        cachePolicy="memory"
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Bar Floating Over Map */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.langButton} onPress={toggleLanguage}>
            <Text style={styles.langText}>{t.toggle}</Text>
          </TouchableOpacity>

          <View style={styles.topBarCenter}>
            <View style={styles.worldNavRow}>
              <TouchableOpacity onPress={goToPrevWorld} style={styles.worldArrowButton}>
                <Text style={styles.worldArrowText}>{isHebrew ? '◀' : '◀'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setShowWorldList(true)} activeOpacity={0.8}>
                <LinearGradient
                  colors={['#FFF0F5', '#FEF9C3', '#E0F2FE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.worldTitleBadge}
                >
                  <Text style={styles.worldTitleIcon}>{activeWorld.icon}</Text>
                  <Text style={styles.worldTitleText} adjustsFontSizeToFit numberOfLines={1}>
                    {isHebrew ? activeWorld.name.he : activeWorld.name.en}
                  </Text>
                  <Text style={styles.worldTitleDropdownArrow}>▼</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={goToNextWorld} style={styles.worldArrowButton}>
                <Text style={styles.worldArrowText}>{isHebrew ? '▶' : '▶'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Map Area */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.mapArea}
          contentContainerStyle={{ height: mapHeight }}
          showsVerticalScrollIndicator={false}
        >
          {/* Path Elements instead of yellow line */}
          {pathElements.map((el) => (
            <View
              key={el.id}
              style={{
                position: 'absolute',
                left: `${el.x}%`,
                top: el.y,
                marginLeft: -20, // center the 40x30 image
                marginTop: -15,
                zIndex: 1,
              }}
            >
              <View style={styles.pathElement}>
                <Image 
                  source={require('../../assets/island-platform_nobg.png')}
                  style={{ width: 40, height: 30, opacity: 0.8 }}
                  contentFit="contain"
                />
              </View>
            </View>
          ))}

          {levels.map((level: any) => (
            <LevelNode
              key={level.id}
              level={level}
              playerChar={playerChar}
              pulseScale={pulseScale}
              characterGlowOpacity={characterGlowOpacity}
              onPress={() => onSelectWorld(activeWorld.id, level.id - 1)}
              onPlay={handlePlayPress}
              t={t}
            />
          ))}
        </ScrollView>

        {/* Floating Menu Bar (Bottom) */}
        <View style={styles.floatingMenuContainer}>
          <LinearGradient 
            colors={['#FFF0F5', '#FEF9C3', '#E0F2FE']} // ורוד רך מאוד -> צהוב פסטל -> תכלת רך
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }} // מעבר אופקי חלק
            style={[styles.floatingMenu, isHebrew && styles.rowReverse]}
          >
            {/* Map Button - navigates to world map overview */}
            <TouchableOpacity style={styles.menuItem} activeOpacity={0.8} onPress={onOpenWorldMap}>
              <LinearGradient
                colors={['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.rainbowBorder}
              >
                <View style={styles.menuIconInnerContainer}>
                  <Image source={require('../../assets/MAP.png')} style={styles.menuIconMap} contentFit="contain" />
                </View>
              </LinearGradient>
              <Text style={[styles.menuText, styles.menuTextActive]}>{t.mapMenu}</Text>
            </TouchableOpacity>

            {/* Album Button */}
            <TouchableOpacity style={styles.menuItem} onPress={onOpenAlbum} activeOpacity={0.8}>
              <LinearGradient
                colors={['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.rainbowBorder}
              >
                <View style={styles.menuIconInnerContainer}>
                  <Image source={require('../../assets/my_album.png')} style={styles.menuIconAlbum} contentFit="contain" />
                </View>
              </LinearGradient>
              <Text style={styles.menuText}>{t.album}</Text>
            </TouchableOpacity>

            {/* Character Button */}
            <TouchableOpacity style={styles.menuItem} onPress={onChangeCharacter} activeOpacity={0.8}>
              <LinearGradient
                colors={['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.rainbowBorder}
              >
                <View style={styles.menuIconInnerContainer}>
                  <Image source={require('../../assets/My_Character.png')} style={styles.menuIconImageFull} contentFit="cover" />
                </View>
              </LinearGradient>
              <Text style={styles.menuText}>{t.characterMenu}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </SafeAreaView>

      {/* World List Modal */}
      <Modal visible={showWorldList} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWorldList(false)}
        >
          <View style={styles.worldListContainer}>
            <LinearGradient
              colors={['#FFF0F5', '#FEF9C3', '#E0F2FE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.worldListGradient}
            >
              <ScrollView showsVerticalScrollIndicator={false} style={styles.worldListScroll}>
                {sortedWorldsList.map(({ world, originalIndex }) => (
                  <TouchableOpacity
                    key={world.id}
                    style={[
                      styles.worldListItem,
                      originalIndex === activeWorldIndex && styles.worldListItemActive
                    ]}
                    onPress={() => selectWorldFromList(originalIndex)}
                  >
                    <Text style={styles.worldListIcon}>{world.icon}</Text>
                    <Text style={[
                      styles.worldListName,
                      originalIndex === activeWorldIndex && styles.worldListNameActive
                    ]}>
                      {isHebrew ? world.name.he : world.name.en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C5CAE9',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6, // Lighten the background to make path pop
  },
  safeArea: {
    flex: 1,
  },
  row: { flexDirection: 'row' },
  rowReverse: { flexDirection: 'row-reverse' },
  topBar: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 10,
    zIndex: 20,
    width: '100%',
    position: 'absolute',
    top: 0,
  },
  topBarCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  worldNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  worldArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  worldArrowText: {
    fontSize: 18,
    color: '#0284C7',
    fontWeight: '900',
  },
  worldTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#FFFFFF', // מסגרת לבנה עבה כמו למטה
    shadowColor: '#0284C7', // צל כחלחל שמתאים למטה
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, // צל עדין כמו למטה
    shadowRadius: 10,
    elevation: 10,
  },
  worldTitleIcon: {
    fontSize: 32,
    marginRight: 8,
  },
  worldTitleText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0284C7', // כחול כיפי שמתאים לצבעים של המפה ולטקסט האקטיבי למטה
    letterSpacing: 2,
    textShadowColor: '#FFFFFF', 
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  langButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10, 
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    position: 'absolute',
    top: 55, // הורדנו כדי שלא יסתיר את השעון/סוללה באייפון (במקום 15)
    left: 4, // ממש מוצמד שמאלה עד הסוף (כמעט נוגע במסך)
    zIndex: 100, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  langText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  mapArea: {
    flex: 1,
    marginTop: -120, // מושך את המפה למעלה מתחת לבר העליון
    paddingTop: 120, // מפצה על המשיכה כדי שהתוכן לא יוסתר, מרווח מספיק מהטופ בר
  },
  levelNodeContainer: {
    position: 'absolute',
    width: 140,
    height: 140,
    marginLeft: -70,
    marginTop: -70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedIconGlow: {
    position: 'absolute',
    top: -25,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  lockEmoji: {
    fontSize: 20,
  },
  statusBadge: {
    position: 'absolute',
    top: -5,
    zIndex: 10,
  },
  statusBadgeCurrent: {
    backgroundColor: '#4B5563',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusBadgeLocked: {
    // No background for locked in the image, just text
  },
  statusBadgeText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusBadgeCompletedWithImage: {
    top: -55,
  },
  completedImageContainer: {
    position: 'absolute',
    bottom: 85, // הועלה למעלה בהתאם
    width: 60,
    height: 60,
    zIndex: 5,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  completedElementImage: {
    width: '100%',
    height: '100%',
  },
  characterContainer: {
    position: 'absolute',
    bottom: 85, // העליתי עוד טיפה טיפונת נגיעונת למעלה
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  characterOnIsland: {
    width: 70, // הוגדל קצת בשביל הנוכחות
    height: 80,
  },
  characterGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
  nodeTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 180,
  },
  islandImage: {
    position: 'absolute',
    width: 200,
    height: 140,
    bottom: 10,
  },
  islandImageDimmed: {
    opacity: 0.7,
    tintColor: '#9CA3AF',
  },
  pathElement: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  islandImageLarge: {
    width: 230,
    height: 160,
    bottom: 0,
  },
  levelButton: {
    position: 'absolute',
    bottom: 25, // מיקום כפתור השלב באי
    width: 60,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#A78BFA', // Purple base
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  levelButtonCompleted: {
    backgroundColor: '#C4B5FD',
  },
  levelButtonCurrent: {
    backgroundColor: '#38BDF8', // Light Blue
    borderColor: '#FFF',
  },
  levelButtonLocked: {
    backgroundColor: '#9CA3AF', // Gray
    borderColor: '#D1D5DB',
  },
  levelButtonLarge: {
    width: 75,
    height: 45,
    borderRadius: 22,
    bottom: -5,
  },
  levelButtonText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  levelButtonTextLocked: {
    color: '#E5E7EB',
  },
  lockIcon: {
    fontSize: 16,
    position: 'absolute',
    top: -15,
  },
  starsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: -15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: {
    fontSize: 16,
    marginHorizontal: -2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  checkBadge: {
    position: 'absolute',
    right: -15,
    bottom: 0,
    backgroundColor: '#3B82F6',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  checkText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playButtonFloatingContainer: {
    position: 'absolute',
    bottom: 130, // מרחף מעל התפריט התחתון
    right: 20, // או left תלוי שפה - נטפל בזה דרך סגנון באלמנט עצמו
    zIndex: 100,
  },
  floatingMenuContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
    zIndex: 50,
  },
  floatingMenu: {
    flexDirection: 'row',
    // backgroundColor הוסר כי שמנו LinearGradient
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 14,
    justifyContent: 'space-between',
    width: '94%',
    shadowColor: '#0284C7', // צל כחלחל שמתאים למשחק
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, // קצת יותר צל
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 4, // מסגרת לבנה עבה ומשחקית (כמו כפתור)
    borderColor: '#FFFFFF', 
  },
  menuItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  rainbowBorder: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    // הילה חמודה מסביב לקשת
    shadowColor: '#FF69B4', // ורוד/סגול זוהר
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  menuIconInnerContainer: {
    width: 68, // עובי קשת דק מאוד (74 - 68 = 6 -> 3 פיקסל מכל צד)
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  menuIconImageFull: {
    width: '100%', 
    height: '100%',
  },
  menuIconMap: {
    width: '100%',
    height: '100%',
    marginTop: -8, // עולה למעלה
    marginLeft: -6, // זז שמאלה
  },
  menuIconAlbum: {
    width: '140%', // הגדלנו עוד יותר את האייקון
    height: '140%',
    marginTop: -12, // עולה עוד קצת למעלה
    marginLeft: 6, // זז עוד קצת ימינה
  },
  menuText: {
    color: '#475569', // אפור פלדה
    fontSize: 16,
    fontWeight: '900',
  },
  menuTextActive: {
    color: '#2563EB',
  },
  worldTitleDropdownArrow: {
    fontSize: 10,
    color: '#0284C7',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  worldListContainer: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  worldListGradient: {
    borderRadius: 20,
    paddingVertical: 12,
  },
  worldListScroll: {
    maxHeight: 400,
  },
  worldListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  worldListItemActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
  },
  worldListIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  worldListName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  worldListNameActive: {
    color: '#0284C7',
    fontWeight: '900',
  },
});

export default HomeView;
