export function getLocationErrorMessage(error) {
  if (error?.code === 1 || error?.code === "LOCATION_PERMISSION_DENIED") {
    return "위치 권한이 허용되지 않았습니다. 기기 설정에서 위치 권한을 허용해주세요.";
  }
  if (error?.code === 3 || error?.code === "LOCATION_TIMEOUT") {
    return "위치 조회 시간이 초과되었습니다.";
  }
  if (error?.code === 2 || error?.code === "E_LOCATION_SERVICES_DISABLED") {
    return "현재 위치를 확인할 수 없습니다. 위치 서비스를 확인해주세요.";
  }
  return error?.message || "현재 위치를 확인할 수 없습니다.";
}
