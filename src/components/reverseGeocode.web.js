export async function getCurrentCoordinate() {
  throw new Error("웹에서는 현재 위치 기능을 사용할 수 없습니다.");
}

export async function reverseGeocode() {
  throw new Error("웹에서는 위치 주소 변환 기능을 사용할 수 없습니다.");
}
