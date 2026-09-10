/*
    GET
    차고지 알림 버스 검색 api
    /api/bus-routes/search
    request:
    검색할 버스번호가 101이라면
    /api/bus-routes/search?query=101

    성공응답:
    #### 200

```json
{
  "code": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": [
    {
      "endPoint": "서소문",
      "routeId": "100100006",
      "routeNm": "101",
      "startPoint": "우이동",
      "term": "8"
    },
    {
      "endPoint": "종로구민회관숭인동",
      "routeId": "100100129",
      "routeNm": "1014",
      "startPoint": "성북생태체험관",
      "term": "8"
    },
    {
      "endPoint": "상왕십리",
      "routeId": "100100130",
      "routeNm": "1017",
      "startPoint": "월계동",
      "term": "15"
    },
    {
      "endPoint": "석수역",
      "routeId": "213000016",
      "routeNm": "101광명",
      "startPoint": "화영운수차고지",
      "term": "12"
    },
    {
      "endPoint": "수서역5번출구",
      "routeId": "228000179",
      "routeNm": "101용인",
      "startPoint": "오리역",
      "term": "35"
    },
    {
      "endPoint": "신분당선강남역",
      "routeId": "228000418",
      "routeNm": "1101N용인",
      "startPoint": "단국대.치과병원",
      "term": "0"
    },
    {
      "endPoint": "신분당선강남역",
      "routeId": "234000879",
      "routeNm": "1101광주",
      "startPoint": "단국대.치과병원",
      "term": "35"
    },
    {
      "endPoint": "서울역버스환승센터",
      "routeId": "235000115",
      "routeNm": "1101양주",
      "startPoint": "덕정차고지(미정차)",
      "term": "60"
    },
    {
      "endPoint": "홍대입구역",
      "routeId": "165000147",
      "routeNm": "1101인천",
      "startPoint": "마전지구버스차고지",
      "term": "35"
    },
    {
      "endPoint": "강남역우리은행",
      "routeId": "216000043",
      "routeNm": "3101안산",
      "startPoint": "원시역1번출구",
      "term": "60"
    },
    {
      "endPoint": "숭례문",
      "routeId": "228000413",
      "routeNm": "4101용인",
      "startPoint": "한숲3단지",
      "term": "60"
    },
    {
      "endPoint": "서울역버스환승센터",
      "routeId": "233000441",
      "routeNm": "5101화성",
      "startPoint": "현대기아연구소",
      "term": "50"
    },
    {
      "endPoint": "김포공항",
      "routeId": "100100373",
      "routeNm": "6101",
      "startPoint": "창동역",
      "term": "200"
    },
    {
      "endPoint": "혜화역2번출구.마로니에공원",
      "routeId": "229000273",
      "routeNm": "7101파주",
      "startPoint": "팜스프링아파트",
      "term": "40"
    },
    {
      "endPoint": "서소문",
      "routeId": "110000005",
      "routeNm": "8101",
      "startPoint": "도봉보건소",
      "term": "10"
    },
    {
      "endPoint": "숭례문",
      "routeId": "228000450",
      "routeNm": "M4101(예약)용인",
      "startPoint": "상현역",
      "term": "21"
    },
    {
      "endPoint": "숭례문",
      "routeId": "234000875",
      "routeNm": "M4101광주",
      "startPoint": "상현역",
      "term": "35"
    }
  ]
}
```

## 에러 응답 예시

#### 400 - 검색어 공백 입력 (INVALID_INPUT_VALUE)

```json
{
  "code": "C002",
  "message": "검색어를 입력해주세요."
}
```

#### 401 - 비로그인 접근 (UNAUTHENTICATED)

```json
{
  "code": "C007",
  "message": "인증이 필요합니다."
}
```
*/