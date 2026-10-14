import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * compences://join/CODE — the path form of a join link. Hands the code to the
 * join screen, which fills it in and looks up the society's flats.
 */
export default function JoinLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/join', params: { code: String(code ?? '') } }} />;
}
