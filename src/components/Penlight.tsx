import { createUseStyles } from "react-jss";
import penlightSrc from "../assets/Penlight Background.svg";
import { useCompositeImage } from "./useCompositeImage";
import type { LogoPlacement } from "./useCompositeImage";
import { useOutlinedImage } from "./useOutlinedImage";
import { usePenlightSheet } from "./usePenlightSheet";

// Where the original logo sat, sized so the Fanimaid logo in the design comes
// out about as wide as the original logo.
const PLACEMENT: LogoPlacement = {
  centerX: 0.5,
  centerY: 0.5,
  width: 0.6,
};

// Sticker-style outlines like the original logo had: white, then pink
// around that. Thicknesses are in the design image's pixels (it's exported
// at 900x900).
const OUTLINE_THICKNESS = 12;
const OUTLINE_COLOR = "#ffffff";
const OUTER_OUTLINE_THICKNESS = 8;
const OUTER_OUTLINE_COLOR = "#D94296";

const useStyles = createUseStyles({
  image: {
    display: "block",
    margin: "0 auto",
    width: "100%",
    maxWidth: 700,
  },
});

type PenlightProps = { logoUrl: string; alt: string };
export const Penlight = ({ logoUrl, alt }: PenlightProps) => {
  const classes = useStyles();
  const whiteOutlinedUrl = useOutlinedImage(
    logoUrl,
    OUTLINE_THICKNESS,
    OUTLINE_COLOR,
  );
  const outlinedLogoUrl = useOutlinedImage(
    whiteOutlinedUrl,
    OUTER_OUTLINE_THICKNESS,
    OUTER_OUTLINE_COLOR,
  );
  const artUrl = useCompositeImage(penlightSrc, PLACEMENT, outlinedLogoUrl);
  const imageUrl = usePenlightSheet(artUrl);

  if (!imageUrl) return null;

  return <img className={classes.image} src={imageUrl} alt={alt} />;
};
