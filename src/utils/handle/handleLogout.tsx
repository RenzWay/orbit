import { orbitModel } from "@/model/model";
import { NavigateFunction } from "react-router-dom";

export async function handleLogout(navigate: NavigateFunction) {
  try {
    await orbitModel.logOut();
    navigate("/login");
  } catch (error) {
    console.error(error);
  }
}