import { useState } from "react";
import { Banner } from "./components/Banner";
import { LogoDesigner } from "./components/LogoDesigner";
import { Penlight } from "./components/Penlight";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
  label: {
    display: "block",
  },
  designer: {
    display: "inline-block",
    position: "relative",
    padding: "20px",
  },
});

function App() {
  const classes = useStyles();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  return (
    <>
      <label className={classes.label}>Enter Cafe Name:</label>
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <div>
        <div className={classes.designer}>
          <LogoDesigner name={name} onImageChange={setImageUrl} />
        </div>
      </div>
      <Banner logoUrl={imageUrl} alt={`${name} banner`} />
      <Penlight logoUrl={imageUrl} alt={`${name} penlight`} />
    </>
  );
}

export default App;
