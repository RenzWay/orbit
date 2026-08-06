import { orbitModel } from "../../model/model";

export async function handleLogin({
  setIsLoading,
}: {
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  setIsLoading(true);
  try {
    await orbitModel.loginWithGoogle();
  } catch (e) {
    console.error(e);
    throw e;
  } finally {
    setIsLoading(false);
  }
}
