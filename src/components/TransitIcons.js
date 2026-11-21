import BGaIcon from "../../assets/bus/b_ga.svg";
import BJiIcon from "../../assets/bus/b_ji.svg";
import BGwIcon from "../../assets/bus/b_gw.svg";
import BSIcon from "../../assets/bus/b_s.svg";
import BOIcon from "../../assets/bus/b_o.svg";
import S1Icon from "../../assets/subway/s_1.svg";
import S2Icon from "../../assets/subway/s_2.svg";
import S3Icon from "../../assets/subway/s_3.svg";
import S4Icon from "../../assets/subway/s_4.svg";
import S5Icon from "../../assets/subway/s_5.svg";
import S6Icon from "../../assets/subway/s_6.svg";
import S7Icon from "../../assets/subway/s_7.svg";
import S8Icon from "../../assets/subway/s_8.svg";
import S9Icon from "../../assets/subway/s_9.svg";
import SBIcon from "../../assets/subway/s_b.svg";
import NBIcon from "../../assets/subway/n_b.svg";
import ACIcon from "../../assets/subway/a_c.svg";
import GCIcon from "../../assets/subway/g_c.svg";
import GGIcon from "../../assets/subway/g_g.svg";

export const BUS_ICONS = {
  b_ga: BGaIcon,
  b_ji: BJiIcon,
  b_gw: BGwIcon,
  b_s: BSIcon,
  b_o: BOIcon,
};

export const SUBWAY_ICONS = {
  s_1: S1Icon,
  s_2: S2Icon,
  s_3: S3Icon,
  s_4: S4Icon,
  s_5: S5Icon,
  s_6: S6Icon,
  s_7: S7Icon,
  s_8: S8Icon,
  s_9: S9Icon,
  s_b: SBIcon,
  n_b: NBIcon,
  a_c: ACIcon,
  g_c: GCIcon,
  g_g: GGIcon,
};

export const TRANSIT_ICONS = {
  ...BUS_ICONS,
  ...SUBWAY_ICONS,
};
