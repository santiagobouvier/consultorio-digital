import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Appointments = () => {
  const navigate = useNavigate();

  // Redirect to Agenda - the main calendar/appointments view
  useEffect(() => {
    navigate("/agenda", { replace: true });
  }, [navigate]);

  return null;
};

export default Appointments;
