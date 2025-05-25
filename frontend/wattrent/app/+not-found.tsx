import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <SafeAreaView className="flex-1 bg-background">
        <View style={styles.container}>
          <Text className="text-2xl font-bold text-foreground mb-4">
            找不到此頁面
          </Text>
          <Link href="/" style={styles.link}>
            <Text className="text-primary text-lg font-medium">
              返回首頁
            </Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
