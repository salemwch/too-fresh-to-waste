import React from 'react';
import {
StyleSheet,
Text,
TouchableWithoutFeedback,
View,
Dimensions,
} from 'react-native';
import Animated, {
useSharedValue,
useAnimatedStyle,
withSpring,
withTiming,
withRepeat,
withSequence,
Easing,
interpolate,
cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUTTON_WIDTH = SCREEN_WIDTH - 60;
const BUTTON_HEIGHT = 64;

const CheckIcon = ({ show }) => {
const style = useAnimatedStyle(() => ({
opacity: withTiming(show.value ? 1 : 0),
transform: [{ scale: withSpring(show.value ? 1 : 0) }],
}));

return (
<Animated.View style={[styles.iconContainer, style]}>
<Svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
<Path d="M20 6L9 17l-5-5" />
</Svg>
</Animated.View>
);
};

export default function LiquidLoginButton() {
const loading = useSharedValue(0);
const fillProgress = useSharedValue(0);
const waveRotate = useSharedValue(0);
const successState = useSharedValue(0);
const scaleButton = useSharedValue(1);

const handlePress = () => {
if (loading.value === 1) return;
loading.value = 1;

    scaleButton.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );

    waveRotate.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );

    fillProgress.value = withTiming(0.9, { duration: 2000, easing: Easing.inOut(Easing.ease) });

    setTimeout(finishLogin, 2500);

};

const finishLogin = () => {
fillProgress.value = withTiming(1.5, { duration: 300 });
successState.value = 1;

    setTimeout(reset, 2500);

};

const reset = () => {
loading.value = 0;
successState.value = 0;
fillProgress.value = withTiming(0);
cancelAnimation(waveRotate);
waveRotate.value = 0;
};

const liquidStyle = useAnimatedStyle(() => {
const translateY = interpolate(
fillProgress.value,
[0, 1],
[BUTTON_HEIGHT * 2, -BUTTON_HEIGHT * 0.5]
);

    return {
      transform: [
        { translateY },
        { rotate: `${waveRotate.value}deg` },
      ],
      backgroundColor: successState.value === 1 ? '#005250' : '#3B82F6',
    };

});

const textStyle = useAnimatedStyle(() => ({
opacity: withTiming(loading.value === 0 ? 1 : 0),
transform: [{ translateY: withTiming(loading.value === 0 ? 0 : -20) }],
}));

const loadingTextStyle = useAnimatedStyle(() => ({
opacity: withTiming(loading.value === 1 && successState.value === 0 ? 1 : 0),
transform: [{ translateY: withTiming(loading.value === 1 && successState.value === 0 ? 0 : 20) }],
}));

const buttonContainerStyle = useAnimatedStyle(() => ({
transform: [{ scale: scaleButton.value }],
borderColor: successState.value === 1 ? '#005250' : '#3B82F6',
}));

return (
<View style={styles.screen}>
<TouchableWithoutFeedback onPress={handlePress}>
<Animated.View style={[styles.button, buttonContainerStyle]}>
<Animated.View style={[styles.liquid, liquidStyle]} />

          <Animated.Text style={[styles.label, textStyle]}>
            LOG IN
          </Animated.Text>

          <Animated.Text style={[styles.loadingLabel, loadingTextStyle]}>
            FILLING UP...
          </Animated.Text>

          <View style={styles.iconWrapper}>
            <CheckIcon show={successState} />
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>

);
}
