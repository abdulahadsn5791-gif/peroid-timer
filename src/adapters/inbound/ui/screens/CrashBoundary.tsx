import { Component, type ErrorInfo, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { tokens } from "../design-system/tokens";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Top-level JS crash boundary. Before this existed, any render-time JS error
 * exited the app with nothing on screen — indistinguishable from a native
 * crash and impossible to report without adb. Now the error and its component
 * stack render instead, so a screenshot is enough to diagnose. Mounting a
 * fresh <App /> on "Restart" rebuilds the composition root from scratch.
 */
export class CrashBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("CrashBoundary caught:", error, info.componentStack);
    this.setState({ info: info.componentStack ?? null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>The app hit an unexpected error and stopped here.</Text>
        <ScrollView style={styles.box}>
          <Text selectable style={styles.errorMessage}>
            {error.name}: {error.message}
          </Text>
          {info ? <Text selectable style={styles.stack}>{info}</Text> : null}
        </ScrollView>
        <Text style={styles.hint}>Long-press to copy this text and report it.</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.canvas,
    padding: tokens.spacing.xl,
    paddingTop: 80,
    gap: tokens.spacing.sm,
  },
  title: {
    fontSize: tokens.text.display,
    fontWeight: "700",
    color: tokens.color.text.primary,
  },
  subtitle: {
    fontSize: tokens.text.subtext,
    color: tokens.color.text.secondary,
  },
  box: {
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.color.hairlineStrong,
    padding: tokens.spacing.lg,
    flexGrow: 0,
  },
  errorMessage: {
    fontSize: tokens.text.subtext,
    fontWeight: "600",
    color: tokens.color.danger,
  },
  stack: {
    marginTop: tokens.spacing.sm,
    fontSize: tokens.text.micro,
    fontFamily: "monospace",
    color: tokens.color.text.secondary,
  },
  hint: {
    fontSize: tokens.text.micro,
    color: tokens.color.text.tertiary,
  },
});
