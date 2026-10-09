import { createUseStyles } from "react-jss";
import bannerSrc from "../assets/banner.png";
import { useCompositeImage } from "./useCompositeImage";
import type { LogoPlacement } from "./useCompositeImage";

// The banner's white circle. The design is wider than the circle because it
// has empty space around it.
const PLACEMENT: LogoPlacement = {
  centerX: 0.208,
  centerY: 0.486,
  width: 0.4,
};

const useStyles = createUseStyles({
  image: {
    display: "block",
    margin: "0 auto",
    width: "100%",
    maxWidth: 700,
  },
});

type BannerProps = { logoUrl: string; alt: string };
export const Banner = ({ logoUrl, alt }: BannerProps) => {
  const classes = useStyles();
  const imageUrl = useCompositeImage(bannerSrc, PLACEMENT, logoUrl);

  if (!imageUrl) return null;

  return <img className={classes.image} src={imageUrl} alt={alt} />;
};
