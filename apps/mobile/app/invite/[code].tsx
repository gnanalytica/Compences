import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * compences://invite/CODE — the path form of an invite link. Hands the code to
 * the invite screen, which looks it up before anybody commits to it.
 */
export default function InviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/invite', params: { code: String(code ?? '') } }} />;
}
